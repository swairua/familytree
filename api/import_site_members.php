<?php
/**
 * CLI importer for site members from the MyHeritage family site.
 *
 * Creates pending user accounts linked to tree individuals (name match).
 * Existing accounts (by individual_id or placeholder email) are skipped so
 * the script is safe to re-run.
 *
 * Usage:
 *   php api/import_site_members.php                    # uses data/captures/site_members.json
 *   php api/import_site_members.php --file path.json   # custom JSON
 *   php api/import_site_members.php --dry-run
 *
 * Input JSON shape:
 *   { "members": [ {"name": "Simon Gichuki Wairua", "role": "Manager"}, ... ] }
 * (a bare array of the same objects is also accepted)
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if (!is_cli()) {
    http_response_code(403);
    exit("CLI only\n");
}

$argv = $argv ?? [];
$file = __DIR__ . '/../data/captures/site_members.json';
$dryRun = false;
foreach ($argv as $i => $arg) {
    if ($arg === '--file' && isset($argv[$i + 1])) $file = $argv[$i + 1];
    if ($arg === '--dry-run') $dryRun = true;
}

if (!is_file($file)) {
    fwrite(STDERR, "ERROR: file not found: {$file}\n");
    exit(1);
}
$raw = file_get_contents($file);
$json = json_decode($raw ?: 'null', true);
$members = null;
if (is_array($json)) {
    $members = $json['members'] ?? $json['items'] ?? ($json === array_values($json) ? $json : null);
}
if (!is_array($members)) {
    fwrite(STDERR, "ERROR: could not find a member list in {$file}\n");
    exit(1);
}
echo "Members in file: " . count($members) . "\n";
echo "Mode: " . ($dryRun ? 'DRY RUN' : 'IMPORT') . "\n\n";

$pdo = db();

function norm_name(string $s): string
{
    $s = mb_strtoupper($s);
    $s = preg_replace('/[^A-Z0-9 ]/', ' ', $s);
    return trim(preg_replace('/\s+/', ' ', $s));
}

$created = 0; $skipped = 0; $unmatched = 0; $ambiguous = 0;
$processed = 0;

foreach ($members as $m) {
    $processed++;
    $name = trim((string)($m['name'] ?? ''));
    $role = strtolower(trim((string)($m['role'] ?? 'member')));
    if ($name === '') { echo "[{$processed}] SKIP (no name)\n"; $skipped++; continue; }
    $isManager = in_array($role, ['manager', 'owner', 'admin'], true);

    $norm = norm_name($name);

    // Unlinked accounts (no confident tree match)
    if (!empty($m['unlinked'])) {
        $placeholder = 'sm-' . substr(md5('unlinked:' . mb_strtolower($name)), 0, 12) . '@placeholder.invalid';
        $exists = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = ?');
        $exists->execute([$placeholder]);
        if ((int)$exists->fetchColumn() > 0) {
            echo "[{$processed}] EXISTS     {$name}  (unlinked account)
";
            $skipped++;
            continue;
        }
        $userRole = $isManager ? 'admin' : 'member';
        $hash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
        if ($dryRun) {
            echo "[{$processed}] WOULD CREATE (unlinked)  {$name}  role={$userRole}  email={$placeholder}
";
        } else {
            try {
                $ins = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, individual_id, role, status) VALUES (?, ?, ?, NULL, ?, ?)');
                $ins->execute([$placeholder, $hash, mb_substr($name, 0, 255), $userRole, 'pending']);
                echo "[{$processed}] CREATED (unlinked)     {$name}  role={$userRole}
";
            } catch (PDOException $e) {
                echo "[{$processed}] ERROR       {$name}: " . $e->getMessage() . "
";
                continue;
            }
        }
        $created++;
        continue;
    }

    // Explicit individual_id or match by normalized given-name+surname
    $candidates = [];
    if (!empty($m['individual_id'])) {
        $stmt = $pdo->prepare('SELECT id, name FROM individuals WHERE id = ?');
        $stmt->execute([$m['individual_id']]);
        $one = $stmt->fetch(PDO::FETCH_ASSOC);
        $candidates = $one ? [$one] : [];
        if (!$one) {
            echo "[{$processed}] BAD ID      {$name}  ({$m['individual_id']} not found)
";
            $unmatched++;
            continue;
        }
    } else {
        $stmt = $pdo->prepare('SELECT id, name, given_name, surname FROM individuals');
        $stmt->execute();
        foreach ($stmt as $row) {
            $cn = norm_name($row['name']);
            if ($cn === $norm) { $candidates[] = $row; continue; }
            $given = norm_name($row['given_name'] ?? '');
            $sur = norm_name($row['surname'] ?? '');
            if ($given && $sur && norm_name(trim($given . ' ' . $sur)) === $norm) { $candidates[] = $row; }
        }
    }
    if (count($candidates) === 0) {
        echo "[{$processed}] UNMATCHED  {$name}\n";
        $unmatched++;
        continue;
    }
    if (count($candidates) > 1) {
        echo "[{$processed}] AMBIGUOUS  {$name}  (candidates: " . implode(', ', array_column($candidates, 'id')) . ")\n";
        $ambiguous++;
        continue;
    }

    $person = $candidates[0];
    $placeholder = 'sm-' . substr(md5($person['id']), 0, 12) . '@placeholder.invalid';

    $exists = $pdo->prepare('SELECT COUNT(*) FROM users WHERE individual_id = ? OR email = ?');
    $exists->execute([$person['id'], $placeholder]);
    if ((int)$exists->fetchColumn() > 0) {
        echo "[{$processed}] EXISTS     {$name}  ({$person['id']})\n";
        $skipped++;
        continue;
    }

    $userRole = $isManager ? 'admin' : 'member';
    $hash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    $displayName = $person['name'] !== '' ? $person['name'] : $name;

    if ($dryRun) {
        echo "[{$processed}] WOULD CREATE  {$displayName}  role={$userRole}  individual={$person['id']}  email={$placeholder}\n";
    } else {
        try {
            $ins = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, individual_id, role, status) VALUES (?, ?, ?, ?, ?, ?)');
            $ins->execute([$placeholder, $hash, mb_substr($displayName, 0, 255), $person['id'], $userRole, 'pending']);
            echo "[{$processed}] CREATED     {$displayName}  role={$userRole}  individual={$person['id']}\n";
        } catch (PDOException $e) {
            echo "[{$processed}] ERROR       {$displayName}: " . $e->getMessage() . "\n";
            continue;
        }
    }
    $created++;
}

echo "\nDone. created={$created} skipped/existing={$skipped} unmatched={$unmatched} ambiguous={$ambiguous}\n";
