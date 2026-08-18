<?php
/**
 * CLI importer: loads a GEDCOM file into the familytree MySQL database.
 *
 * Usage:
 *   php import_gedcom.php                       # uses data/myheritage_export.ged
 *   php import_gedcom.php --file path/to.ged
 *   php import_gedcom.php --file path --dry-run
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/gedcomParser.php';

if (!is_cli()) {
    http_response_code(403);
    exit("CLI only\n");
}

// ---- parse args -----------------------------------------------------------
$file = null;
$dryRun = false;
foreach ($argv as $i => $arg) {
    if ($arg === '--file' && isset($argv[$i + 1])) $file = $argv[$i + 1];
    if ($arg === '--dry-run') $dryRun = true;
}
if ($file === null) {
    $file = __DIR__ . '/../data/myheritage_export.ged';
}

echo "Family Tree GEDCOM importer\n";
echo "===========================\n";
echo "File:   {$file}\n";
echo "Mode:   " . ($dryRun ? "DRY RUN" : "IMPORT") . "\n\n";

if (!is_file($file)) {
    fwrite(STDERR, "ERROR: File not found: {$file}\n");
    exit(1);
}

$content = file_get_contents($file);
if ($content === false || $content === '') {
    fwrite(STDERR, "ERROR: Could not read file (empty?).\n");
    exit(1);
}

echo "Parsing GEDCOM...\n";
$parser = new GEDCOMParser();
$data = $parser->parse($content);

$stats = $data['stats'];
echo "Individuals: {$stats['individualCount']}\n";
echo "Families:    {$stats['familyCount']}\n";
echo "Errors:      " . count($data['errors']) . "\n";

if (!empty($data['errors'])) {
    foreach (array_slice($data['errors'], 0, 10) as $err) {
        echo "  - {$err}\n";
    }
}

if ($stats['individualCount'] === 0) {
    fwrite(STDERR, "ERROR: No individuals parsed. Aborting.\n");
    exit(1);
}

if ($dryRun) {
    echo "\nDry run complete — nothing written to DB.\n";
    exit(0);
}

// ---- import ----------------------------------------------------------------
$pdo = db();

// Clear tables BEFORE opening a transaction (ALTER TABLE would auto-commit mid-transaction)
$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
foreach (['family_children', 'events', 'families', 'individuals'] as $t) {
    $pdo->exec("DELETE FROM {$t}");
    $pdo->exec("ALTER TABLE {$t} AUTO_INCREMENT = 1");
}
$pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

$pdo->beginTransaction();

try {
    $indStmt = $pdo->prepare(
        'INSERT INTO individuals (id, name, given_name, surname, prefix, suffix, nickname, gender,
            birth_date, birth_place, death_date, death_place, burial_date, burial_place,
            occupation, education, religion, photo, notes, birth_year, death_year)
         VALUES (:id, :name, :given, :surname, :prefix, :suffix, :nick, :gender,
            :birth_date, :birth_place, :death_date, :death_place, :burial_date, :burial_place,
            :occupation, :education, :religion, :photo, :notes, :birth_year, :death_year)'
    );

    $count = 0;
    foreach ($data['individuals'] as $ind) {
        $ind = array_merge([
            'id' => '', 'name' => '', 'givenName' => '', 'surname' => '', 'prefix' => '',
            'suffix' => '', 'nickname' => '', 'gender' => 'unknown',
            'birthDate' => '', 'birthPlace' => '', 'deathDate' => '', 'deathPlace' => '',
            'burialDate' => '', 'burialPlace' => '', 'occupation' => '', 'education' => '',
            'religion' => '', 'photo' => '', 'notes' => [],
        ], $ind);

        $gender = in_array($ind['gender'], ['male', 'female', 'unknown'], true) ? $ind['gender'] : 'unknown';
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
            ':photo' => mb_substr($ind['photo'] ?? '', 0, 255),
            ':notes' => implode("\n", array_values($ind['notes'] ?? [])),
            ':birth_year' => extract_year($ind['birthDate']),
            ':death_year' => extract_year($ind['deathDate']),
        ]);
        $count++;
        if ($count % 500 === 0) echo "  ...{$count} individuals imported\n";
    }
    echo "Individuals imported: {$count}\n";

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

    $famCount = 0;
    $childCount = 0;
    foreach ($data['families'] as $fam) {
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
        $famCount++;

        $pos = 0;
        foreach ($fam['childrenIds'] ?? [] as $childId) {
            $childStmt->execute([':fid' => $fam['id'], ':cid' => $childId, ':pos' => $pos++]);
            $childCount++;
        }
    }
    echo "Families imported: {$famCount} (children links: {$childCount})\n";

    $eventCount = 0;
    foreach ($data['individuals'] as $ind) {
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
            $eventCount++;
        }
    }
    echo "Events imported: {$eventCount}\n";

    $pdo->commit();
    echo "\nIMPORT COMPLETE ✓\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, "ERROR: " . $e->getMessage() . "\n");
    exit(1);
}
