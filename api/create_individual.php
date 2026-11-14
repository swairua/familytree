<?php
/**
 * Create a new individual and attach them as a parent to a given child.
 *
 * POST create_individual.php
 * Body: { childId, role: 'father'|'mother', givenName, surname, gender, birthDate, birthPlace, photo }
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if (!is_cli()) {
    header('Content-Type: application/json; charset=utf-8');
    send_cors_headers();
}

$input = read_json_body();
$childId = trim((string)($input['childId'] ?? ''));
$role = $input['role'] ?? '';
if ($childId === '' || !in_array($role, ['father', 'mother'], true)) {
    send_error('childId and role (father|mother) are required', 400);
}

function next_individual_id(PDO $pdo): string
{
    $stmt = $pdo->query("SELECT id FROM individuals WHERE id REGEXP '^@I[0-9]+@$' ORDER BY LENGTH(id) DESC, id DESC LIMIT 1");
    $row = $stmt->fetch(PDO::FETCH_NUM);
    if ($row && preg_match('/^@I(\d+)@$/', $row[0], $m)) {
        $next = (int) $m[1] + 1;
    } else {
        $next = 1;
    }
    return '@I' . str_pad((string) $next, 7, '0', STR_PAD_LEFT) . '@';
}

function normalize_person_fields(array $input): array
{
    return [
        'givenName'  => trim((string)($input['givenName'] ?? '')),
        'surname'    => trim((string)($input['surname'] ?? '')),
        'surname'    => trim((string)($input['surname'] ?? '')),
        'prefix'     => trim((string)($input['prefix'] ?? '')),
        'suffix'     => trim((string)($input['suffix'] ?? '')),
        'birthDate'  => trim((string)($input['birthDate'] ?? '')),
        'deathDate'  => trim((string)($input['deathDate'] ?? '')),
        'birthPlace' => trim((string)($input['birthPlace'] ?? '')),
        'deathPlace' => trim((string)($input['deathPlace'] ?? '')),
        'occupation' => trim((string)($input['occupation'] ?? '')),
        'education'  => trim((string)($input['education'] ?? '')),
        'religion'   => trim((string)($input['religion'] ?? '')),
        'gender'     => in_array(($input['gender'] ?? 'unknown'), ['male','female','unknown'], true) ? $input['gender'] : 'unknown',
        'photo'      => trim((string)($input['photo'] ?? '')),
        'notes'      => isset($input['notes']) ? (string) $input['notes'] : '',
    ];
}

$pdo = db();

// Ensure child exists
$child = $pdo->prepare('SELECT id FROM individuals WHERE id = ?');
$child->execute([$childId]);
if (!$child->fetch()) {
    send_error('Child individual not found', 404);
}

// Check that this role is currently empty for this child (no parent in that slot yet)
$stmt = $pdo->prepare(
    'SELECT f.id, f.husband_id, f.wife_id
     FROM families f JOIN family_children fc ON fc.family_id = f.id
     WHERE fc.child_id = ?'
);
$stmt->execute([$childId]);
$fams = $stmt->fetchAll(PDO::FETCH_ASSOC);

// pick the first parent family that matches role slot
$targetFamilyId = null;
$targetSlot = null;
foreach ($fams as $fam) {
    if ($role === 'father' && (empty($fam['husband_id']))) {
        $targetFamilyId = $fam['id'];
        $targetSlot = 'husband_id';
        break;
    }
    if ($role === 'mother' && (empty($fam['wife_id']))) {
        $targetFamilyId = $fam['id'];
        $targetSlot = 'wife_id';
        break;
    }
}

$pdo->beginTransaction();

// Generate new individual id
$newId = next_individual_id($pdo);
$n = normalize_person_fields($input);

$gender = $n['gender'];
if ($role === 'father' && $gender === 'unknown') $gender = 'male';
if ($role === 'mother' && $gender === 'unknown') $gender = 'female';

$ins = $pdo->prepare(
    'INSERT INTO individuals
        (id, name, given_name, surname, prefix, suffix, nickname, gender,
         birth_date, birth_place, death_date, death_place, burial_date, burial_place,
         occupation, education, religion, photo, notes, birth_year, death_year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$ins->execute([
    $newId,
    trim($n['givenName'] . ' ' . $n['surname']),
    $n['givenName'],
    $n['surname'],
    $n['prefix'],
    $n['suffix'],
    '',
    $gender,
    $n['birthDate'],
    $n['birthPlace'],
    $n['deathDate'],
    $n['deathPlace'],
    '',
    '',
    $n['occupation'],
    $n['education'],
    $n['religion'],
    $n['photo'],
    $n['notes'],
    extract_year($n['birthDate']),
    extract_year($n['deathDate']),
]);

// Assign to family
if ($targetFamilyId) {
    $upd = $pdo->prepare("UPDATE families SET $targetSlot = ? WHERE id = ?");
    $upd->execute([$newId, $targetFamilyId]);
} else {
    // Create a new family with just this child and the new parent
    $famStmt = $pdo->prepare('INSERT INTO families (id, husband_id, wife_id, marriage_date, marriage_place) VALUES (?, ?, ?, ?, ?)');
    $famId   = '@F' . str_pad((string) random_int(100000, 999999), 6, '0', STR_PAD_LEFT) . '@';
    $famStmt->execute([
        $famId,
        $role === 'father' ? $newId : null,
        $role === 'mother' ? $newId : null,
        '',
        '',
    ]);
    $insChild = $pdo->prepare('INSERT INTO family_children (family_id, child_id, position) VALUES (?, ?, ?)');
    $insChild->execute([$famId, $childId, 0]);
}

$pdo->commit();

echo json_encode([
    'ok' => true,
    'id' => $newId,
    'name' => trim($n['givenName'] . ' ' . $n['surname']),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);