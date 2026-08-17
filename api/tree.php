<?php
/**
 * Family Tree API endpoints.
 *
 * GET
 *   tree.php?action=summary
 *   tree.php?action=individuals                (list, with optional ?q= search)
 *   tree.php?action=individual&id=@I1@
 *   tree.php?action=families
 *   tree.php?action=events
 *   tree.php?action=export                     (returns full JSON snapshot of DB)
 *
 * POST (JSON body)
 *   tree.php?action=import    { gedcom: "0 HEAD\n..." }  or  { data: {...parsed snapshot...} }
 *   tree.php?action=clear
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/gedcomParser.php';

send_cors_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = db();
    $action = $_GET['action'] ?? 'summary';

    switch ($action) {
        case 'summary':
            handleSummary($pdo);
            break;
        case 'individuals':
            handleIndividuals($pdo);
            break;
        case 'individual':
            handleIndividual($pdo);
            break;
        case 'families':
            handleFamilies($pdo);
            break;
        case 'events':
            handleEvents($pdo);
            break;
        case 'export':
            handleExport($pdo);
            break;
        case 'import':
            handleImport($pdo);
            break;
        case 'clear':
            handleClear($pdo);
            break;
        default:
            send_error("Unknown action: {$action}", 404);
    }
} catch (Throwable $e) {
    send_error('Server error: ' . $e->getMessage(), 500);
}

// ---------------------------------------------------------------------------

function handleSummary(PDO $pdo): void
{
    $stats = [
        'individualCount' => (int) $pdo->query('SELECT COUNT(*) FROM individuals')->fetchColumn(),
        'familyCount'     => (int) $pdo->query('SELECT COUNT(*) FROM families')->fetchColumn(),
        'eventCount'      => (int) $pdo->query('SELECT COUNT(*) FROM events')->fetchColumn(),
    ];

    $living = 0;
    $male = 0;
    $female = 0;
    $knownBirth = 0;
    foreach ($pdo->query('SELECT gender, birth_year, death_year FROM individuals') as $row) {
        if ($row['gender'] === 'male') $male++;
        if ($row['gender'] === 'female') $female++;
        if ($row['birth_year']) $knownBirth++;
        if (!$row['death_year']) $living++;
    }

    send_json([
        'ok' => true,
        'stats' => $stats,
        'gender' => ['male' => $male, 'female' => $female, 'unknown' => $stats['individualCount'] - $male - $female],
        'living' => $living,
        'deceased' => $stats['individualCount'] - $living,
        'withBirthYear' => $knownBirth,
    ]);
}

function handleIndividuals(PDO $pdo): void
{
    $q = trim($_GET['q'] ?? '');
    $sql = 'SELECT * FROM individuals';
    $params = [];

    if ($q !== '') {
        $sql .= ' WHERE name LIKE ? OR given_name LIKE ? OR surname LIKE ? OR birth_place LIKE ? OR death_place LIKE ?';
        $params = array_fill(0, 5, '%' . $q . '%');
    }
    $sql .= ' ORDER BY surname, given_name, name';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $individuals = array_map('row_to_individual', $rows);
    attach_relationships_bulk($individuals, $pdo);

    send_json(['ok' => true, 'individuals' => $individuals, 'count' => count($individuals)]);
}

function handleIndividual(PDO $pdo): void
{
    $id = $_GET['id'] ?? '';
    if ($id === '') send_error('Missing id parameter');

    $stmt = $pdo->prepare('SELECT * FROM individuals WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    if (!$row) send_error('Individual not found: ' . $id, 404);

    $ind = row_to_individual($row);
    $ind = attach_relationships($ind, $pdo);

    // events
    $estmt = $pdo->prepare('SELECT type, `date`, place, description FROM events WHERE individual_id = :id ORDER BY id');
    $estmt->execute([':id' => $id]);
    $ind['events'] = array_map(function ($e) {
        $e['type'] = strtolower((string) $e['type']);
        return $e;
    }, $estmt->fetchAll());

    send_json(['ok' => true, 'individual' => $ind]);
}

function handleFamilies(PDO $pdo): void
{
    $families = $pdo->query('SELECT * FROM families ORDER BY id')->fetchAll();

    $childStmt = $pdo->prepare('SELECT child_id FROM family_children WHERE family_id = :fid ORDER BY position');
    foreach ($families as &$fam) {
        $childStmt->execute([':fid' => $fam['id']]);
        $fam['childrenIds'] = array_column($childStmt->fetchAll(), 'child_id');
        unset($fam['created_at'], $fam['updated_at']);
    }

    send_json(['ok' => true, 'families' => $families, 'count' => count($families)]);
}

function handleEvents(PDO $pdo): void
{
    $events = $pdo->query('SELECT * FROM events ORDER BY id')->fetchAll();
    send_json(['ok' => true, 'events' => $events, 'count' => count($events)]);
}

function handleExport(PDO $pdo): void
{
    // Full DB snapshot shaped like the parser output (usable by the frontend).
    $rows = $pdo->query('SELECT * FROM individuals')->fetchAll();
    $individuals = array_map('row_to_individual', $rows);
    attach_relationships_bulk($individuals, $pdo);

    $families = [];
    $childStmt = $pdo->prepare('SELECT child_id FROM family_children WHERE family_id = :fid ORDER BY position');
    foreach ($pdo->query('SELECT * FROM families')->fetchAll() as $fam) {
        $childStmt->execute([':fid' => $fam['id']]);
        $fam['childrenIds'] = array_column($childStmt->fetchAll(), 'child_id');
        $families[] = [
            'id' => $fam['id'],
            'husbandId' => $fam['husband_id'],
            'wifeId' => $fam['wife_id'],
            'childrenIds' => $fam['childrenIds'],
            'marriageDate' => $fam['marriage_date'],
            'marriagePlace' => $fam['marriage_place'],
            'divorceDate' => $fam['divorce_date'],
            'notes' => [],
            'sources' => [],
        ];
    }

    $events = [];
    foreach ($pdo->query('SELECT * FROM events')->fetchAll() as $e) {
        $events[] = [
            'type' => strtolower((string) $e['type']),
            'date' => $e['date'],
            'place' => $e['place'],
            'description' => $e['description'],
        ];
    }

    send_json([
        'ok' => true,
        'header' => ['sourceName' => 'MyHeritage (imported via PHP backend)'],
        'individuals' => $individuals,
        'families' => $families,
        'sources' => [],
        'repositories' => [],
        'media' => [],
        'notes' => [],
        'submitters' => [],
        'errors' => [],
        'stats' => [
            'individualCount' => count($individuals),
            'familyCount' => count($families),
            'sourceCount' => 0,
            'mediaCount' => 0,
        ],
    ]);
}

function handleImport(PDO $pdo): void
{
    $body = read_json_body();

    // Accept either raw GEDCOM text or a pre-parsed snapshot.
    $data = null;
    if (!empty($body['gedcom'])) {
        $parser = new GEDCOMParser();
        $data = $parser->parse($body['gedcom']);
    } elseif (!empty($body['data'])) {
        $data = $body['data'];
    } else {
        send_error('Provide either "gedcom" text or a "data" snapshot');
    }

    $pdo->beginTransaction();
    try {
        // Clear existing data (ALTER TABLE inside txn would auto-commit, so delete only)
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        foreach (['family_children', 'events', 'families', 'individuals'] as $t) {
            $pdo->exec("DELETE FROM {$t}");
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

        $indStmt = $pdo->prepare(
            'INSERT INTO individuals (id, name, given_name, surname, prefix, suffix, nickname, gender,
                birth_date, birth_place, death_date, death_place, burial_date, burial_place,
                occupation, education, religion, photo, notes, birth_year, death_year)
             VALUES (:id, :name, :given, :surname, :prefix, :suffix, :nick, :gender,
                :birth_date, :birth_place, :death_date, :death_place, :burial_date, :burial_place,
                :occupation, :education, :religion, :photo, :notes, :birth_year, :death_year)'
        );

        foreach ($data['individuals'] ?? [] as $ind) {
            $ind = array_merge([
                'id' => '', 'name' => '', 'givenName' => '', 'surname' => '', 'prefix' => '',
                'suffix' => '', 'nickname' => '', 'gender' => 'unknown',
                'birthDate' => '', 'birthPlace' => '', 'deathDate' => '', 'deathPlace' => '',
                'burialDate' => '', 'burialPlace' => '', 'occupation' => '', 'education' => '',
                'religion' => '', 'photo' => '', 'notes' => [],
            ], $ind);

            $gender = in_array($ind['gender'], ['male', 'female', 'unknown'], true) ? $ind['gender'] : 'unknown';
            $notes = implode("\n", array_values($ind['notes'] ?? []));

            $indStmt->execute([
                ':id' => $ind['id'],
                ':name' => mb_substr($ind['name'] ?: 'Unknown', 0, 255),
                ':given' => mb_substr($ind['givenName'], 0, 128),
                ':surname' => mb_substr($ind['surname'], 0, 128),
                ':prefix' => mb_substr($ind['prefix'], 0, 32),
                ':suffix' => mb_substr($ind['suffix'], 0, 32),
                ':nick' => mb_substr($ind['nickname'], 0, 128),
                ':gender' => $gender,
                ':birth_date' => mb_substr($ind['birthDate'], 0, 64),
                ':birth_place' => mb_substr($ind['birthPlace'], 0, 255),
                ':death_date' => mb_substr($ind['deathDate'], 0, 64),
                ':death_place' => mb_substr($ind['deathPlace'], 0, 255),
                ':burial_date' => mb_substr($ind['burialDate'], 0, 64),
                ':burial_place' => mb_substr($ind['burialPlace'], 0, 255),
                ':occupation' => mb_substr($ind['occupation'], 0, 255),
                ':education' => mb_substr($ind['education'], 0, 255),
                ':religion' => mb_substr($ind['religion'], 0, 128),
                ':photo' => $ind['photo'] ?? '',
                ':notes' => $notes,
                ':birth_year' => extract_year($ind['birthDate']),
                ':death_year' => extract_year($ind['deathDate']),
            ]);
        }

        $famStmt = $pdo->prepare(
            'INSERT INTO families (id, husband_id, wife_id, marriage_date, marriage_place, divorce_date, notes)
             VALUES (:id, :husband, :wife, :marriage_date, :marriage_place, :divorce_date, :notes)'
        );
        $childStmt = $pdo->prepare(
            'INSERT INTO family_children (family_id, child_id, position) VALUES (:fid, :cid, :pos)'
        );
        $evStmt = $pdo->prepare(
            'INSERT INTO events (individual_id, family_id, type, `date`, place, description)
             VALUES (:iid, :fid, :type, :date, :place, :desc)'
        );

        foreach ($data['families'] ?? [] as $fam) {
            $fam = array_merge([
                'id' => '', 'husbandId' => null, 'wifeId' => null, 'childrenIds' => [],
                'marriageDate' => '', 'marriagePlace' => '', 'divorceDate' => '', 'notes' => [],
            ], $fam);

            $famStmt->execute([
                ':id' => $fam['id'],
                ':husband' => $fam['husbandId'] ?: null,
                ':wife' => $fam['wifeId'] ?: null,
                ':marriage_date' => mb_substr($fam['marriageDate'], 0, 64),
                ':marriage_place' => mb_substr($fam['marriagePlace'], 0, 255),
                ':divorce_date' => mb_substr($fam['divorceDate'], 0, 64),
                ':notes' => implode("\n", array_values($fam['notes'] ?? [])),
            ]);

            $pos = 0;
            foreach ($fam['childrenIds'] ?? [] as $childId) {
                $childStmt->execute([':fid' => $fam['id'], ':cid' => $childId, ':pos' => $pos++]);
            }
        }

        // Individual + family events
        foreach ($data['individuals'] ?? [] as $ind) {
            foreach ($ind['events'] ?? [] as $event) {
                if (empty($event['date']) && empty($event['place'])) continue;
                $evStmt->execute([
                    ':iid' => $ind['id'],
                    ':fid' => null,
                    ':type' => mb_substr(strtoupper($event['type'] ?? 'EVEN'), 0, 16),
                    ':date' => mb_substr($event['date'] ?? '', 0, 64),
                    ':place' => mb_substr($event['place'] ?? '', 0, 255),
                    ':desc' => mb_substr($event['description'] ?? '', 0, 1000),
                ]);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    handleSummary($pdo);
}

function handleClear(PDO $pdo): void
{
    $pdo->beginTransaction();
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach (['family_children', 'events', 'families', 'individuals'] as $t) {
        $pdo->exec("DELETE FROM {$t}");
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    $pdo->commit();
    send_json(['ok' => true, 'cleared' => true]);
}

// ---------------------------------------------------------------------------

function row_to_individual(array $row): array
{
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'givenName' => $row['given_name'],
        'surname' => $row['surname'],
        'prefix' => $row['prefix'],
        'suffix' => $row['suffix'],
        'nickname' => $row['nickname'],
        'gender' => $row['gender'],
        'birthDate' => $row['birth_date'],
        'birthPlace' => $row['birth_place'],
        'deathDate' => $row['death_date'],
        'deathPlace' => $row['death_place'],
        'burialDate' => $row['burial_date'],
        'burialPlace' => $row['burial_place'],
        'occupation' => $row['occupation'],
        'education' => $row['education'],
        'religion' => $row['religion'],
        'photo' => $row['photo'] ?? '',
        'notes' => $row['notes'] ? explode("\n", $row['notes']) : [],
        'sources' => [],
        'media' => [],
        'events' => [],
        'familyIds' => [],
        'parentFamilyIds' => [],
        'spouseFamilyIds' => [],
        'parents' => [],
        'spouses' => [],
        'children' => [],
        'siblings' => [],
    ];
}

/**
 * Efficiently attach relationships to a set of individuals with a handful of
 * queries instead of N+1 per-individual queries.
 *
 * @param array<int,array> $individuals list of individual arrays (by reference, mutated)
 */
function attach_relationships_bulk(array &$individuals, PDO $pdo): void
{
    if (count($individuals) === 0) return;

    // Load all families once
    $families = [];
    foreach ($pdo->query('SELECT id, husband_id, wife_id FROM families')->fetchAll() as $fam) {
        $families[$fam['id']] = [
            'husband_id' => $fam['husband_id'],
            'wife_id'    => $fam['wife_id'],
            'children'   => [],
        ];
    }

    // Load all family-children once, grouped by family
    $childRows = $pdo->query('SELECT family_id, child_id FROM family_children ORDER BY family_id, position')->fetchAll();
    foreach ($childRows as $cr) {
        $families[$cr['family_id']]['children'][] = $cr['child_id'];
    }

    // Indexes: person -> families (as parent or child)
    $asParent = []; // personId => [famId...]  (husband or wife)
    $asChild  = []; // personId => [famId...]
    foreach ($families as $fid => $fam) {
        if ($fam['husband_id'] !== null) $asParent[$fam['husband_id']][] = $fid;
        if ($fam['wife_id'] !== null)    $asParent[$fam['wife_id']][]    = $fid;
        foreach ($fam['children'] as $cid) {
            $asChild[$cid][] = $fid;
        }
    }

    // index child presence per family for sibling computation
    $childSet = []; // famId => [childId => true]
    foreach ($families as $fid => $fam) {
        $childSet[$fid] = array_flip($fam['children']);
    }

    $seenSpouse = [];
    $seenChild  = [];
    $seenParent = [];

    foreach ($individuals as $i => &$ind) {
        $myId = $ind['id'];

        $ind['spouseFamilyIds'] = $asParent[$myId] ?? [];
        $ind['parentFamilyIds'] = $asChild[$myId]  ?? [];
        $ind['familyIds'] = array_values(array_unique(array_merge(
            $ind['spouseFamilyIds'],
            $ind['parentFamilyIds']
        )));

        // spouses from spouse families
        foreach ($asParent[$myId] ?? [] as $fid) {
            $fam = $families[$fid];
            $spouseId = $fam['husband_id'] === $myId ? $fam['wife_id'] : $fam['husband_id'];
            if ($spouseId !== null && !isset($seenSpouse[$myId][$spouseId])) {
                $seenSpouse[$myId][$spouseId] = true;
                $ind['spouses'][] = $spouseId;
            }
        }

        // children from spouse families
        foreach ($asParent[$myId] ?? [] as $fid) {
            foreach ($families[$fid]['children'] as $cid) {
                if ($cid !== $myId && !isset($seenChild[$myId][$cid])) {
                    $seenChild[$myId][$cid] = true;
                    $ind['children'][] = $cid;
                }
            }
        }

        // parents from parent families
        foreach ($asChild[$myId] ?? [] as $fid) {
            $fam = $families[$fid];
            foreach ([$fam['husband_id'], $fam['wife_id']] as $parentId) {
                if ($parentId !== null && $parentId !== $myId && !isset($seenParent[$myId][$parentId])) {
                    $seenParent[$myId][$parentId] = true;
                    $ind['parents'][] = $parentId;
                }
            }
        }

        // siblings = other children of all parent families
        $siblings = [];
        foreach ($asChild[$myId] ?? [] as $fid) {
            foreach ($childSet[$fid] as $sid => $_) {
                if ($sid !== $myId) $siblings[] = $sid;
            }
        }
        $ind['siblings'] = array_values(array_unique($siblings));
        unset($ind);
    }
}

function attach_relationships(array $ind, PDO $pdo): array
{
    // parents / children / spouses / family links derived from families table
    $stmt = $pdo->prepare('SELECT * FROM families WHERE husband_id = :idh OR wife_id = :idw OR id IN (SELECT family_id FROM family_children WHERE child_id = :idc)');
    $stmt->execute([':idh' => $ind['id'], ':idw' => $ind['id'], ':idc' => $ind['id']]);

    foreach ($stmt->fetchAll() as $fam) {
        $ind['familyIds'][] = $fam['id'];

        // children of this family
        $cStmt = $pdo->prepare('SELECT child_id FROM family_children WHERE family_id = ? ORDER BY position');
        $cStmt->execute([$fam['id']]);
        $childrenInFam = array_column($cStmt->fetchAll(), 'child_id');

        if ($fam['husband_id'] === $ind['id'] || $fam['wife_id'] === $ind['id']) {
            $ind['spouseFamilyIds'][] = $fam['id'];
            $spouseId = $fam['husband_id'] === $ind['id'] ? $fam['wife_id'] : $fam['husband_id'];
            if ($spouseId && !in_array($spouseId, $ind['spouses'], true)) $ind['spouses'][] = $spouseId;
        }

        // children
        foreach ($childrenInFam as $cid) {
            if (($fam['husband_id'] === $ind['id'] || $fam['wife_id'] === $ind['id']) && $cid !== $ind['id']) {
                if (!in_array($cid, $ind['children'], true)) $ind['children'][] = $cid;
            }
            if ($cid === $ind['id']) {
                $ind['parentFamilyIds'][] = $fam['id'];
                foreach ([$fam['husband_id'], $fam['wife_id']] as $parentId) {
                    if ($parentId && $parentId !== $ind['id'] && !in_array($parentId, $ind['parents'], true)) {
                        $ind['parents'][] = $parentId;
                    }
                }
            }
        }
    }

    // siblings from parent families
    $siblings = [];
    foreach ($ind['parentFamilyIds'] as $pfid) {
        $sStmt = $pdo->prepare('SELECT child_id FROM family_children WHERE family_id = ? ORDER BY position');
        $sStmt->execute([$pfid]);
        foreach ($sStmt->fetchAll() as $srow) {
            $sid = $srow['child_id'];
            if ($sid !== $ind['id'] && !in_array($sid, $siblings, true)) $siblings[] = $sid;
        }
    }
    $ind['siblings'] = $siblings;
    $ind['parentFamilyIds'] = array_values(array_unique($ind['parentFamilyIds']));
    $ind['spouseFamilyIds'] = array_values(array_unique($ind['spouseFamilyIds']));
    $ind['familyIds'] = array_values(array_unique($ind['familyIds']));

    return $ind;
}
