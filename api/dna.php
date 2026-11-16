<?php
/**
 * Family DNA registry: member-maintained list of tested kits and notable
 * matches. Never stores raw DNA — only provider, result status and the
 * match notes a member types in themselves.
 *
 * Signed-in members only (this is family data).
 *
 *   GET  dna.php?action=list              -> { kits: [...], matches: [...] }
 *   POST dna.php?action=kit-create        { provider, result_date?, visible_to_members? }
 *   POST dna.php?action=kit-update        { id, provider, result_date? }
 *   POST dna.php?action=kit-toggle        { id }                     (privacy: visible to members or not)
 *   POST dna.php?action=kit-delete        { id }
 *   POST dna.php?action=match-add         { kit_id, match_name, provider?, predicted_relationship?, shared_surname?, shared_cm?, notes? }
 *   POST dna.php?action=match-delete      { id }
 *
 * Members manage their own kits and matches. Admins may manage everything.
 * Visibility: a kit hidden by its owner is shown only to the owner + admins,
 * and its matches are hidden with it.
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_lib.php';

send_cors_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const PROVIDERS = ['myheritage_dna', 'ancestrydna', '23andme', 'familytreedna', 'livingdna', 'other'];

try {
    $pdo = db();
    $me = require_active_session_user($pdo);
    $action = $_GET['action'] ?? 'list';

    switch ($action) {
        case 'list':
            handleList($pdo, $me);
            break;
        case 'kit-create':
            handleKitCreate($pdo, $me);
            break;
        case 'kit-update':
            handleKitUpdate($pdo, $me);
            break;
        case 'kit-toggle':
            handleKitToggle($pdo, $me);
            break;
        case 'kit-delete':
            handleKitDelete($pdo, $me);
            break;
        case 'match-add':
            handleMatchAdd($pdo, $me);
            break;
        case 'match-delete':
            handleMatchDelete($pdo, $me);
            break;
        default:
            send_error('Unknown action ' . $action, 404);
    }
} catch (Throwable $e) {
    send_error('Server error: ' . $e->getMessage(), 500);
}

// ---------------------------------------------------------------------------

function is_admin(array $me): bool
{
    return ($me['role'] ?? '') === 'admin';
}

function can_see_kit(array $kit, array $me): bool
{
    return is_admin($me) || (int)$kit['user_id'] === (int)$me['id'] || (int)$kit['visible_to_members'] === 1;
}

function get_kit_or_404(PDO $pdo, int $kitId): array
{
    $s = $pdo->prepare('SELECT k.*, u.display_name AS owner_name FROM dna_kits k JOIN users u ON u.id = k.user_id WHERE k.id = ?');
    $s->execute([$kitId]);
    $kit = $s->fetch();
    if (!$kit) send_error('Kit not found', 404);
    return $kit;
}

function kit_row(array $k): array
{
    return [
        'id' => (int)$k['id'],
        'owner_id' => (int)$k['user_id'],
        'owner_name' => (string)$k['owner_name'],
        'provider' => (string)$k['provider'],
        'result_date' => $k['result_date'] ? (string)$k['result_date'] : null,
        'visible_to_members' => (int)$k['visible_to_members'] === 1,
        'created_at' => (string)$k['created_at'],
    ];
}

function handleList(PDO $pdo, array $me): void
{
    $kitRows = $pdo->query(
        'SELECT k.*, u.display_name AS owner_name
         FROM dna_kits k JOIN users u ON u.id = k.user_id
         ORDER BY k.result_date IS NULL DESC, k.result_date DESC, k.created_at DESC'
    )->fetchAll();

    $visibleKitIds = [];
    $kits = [];
    foreach ($kitRows as $k) {
        if (!can_see_kit($k, $me)) continue;
        $kits[] = kit_row($k);
        $visibleKitIds[] = (int)$k['id'];
    }

    $matches = [];
    if ($visibleKitIds) {
        $place = implode(',', array_fill(0, count($visibleKitIds), '?'));
        $stmt = $pdo->prepare(
            "SELECT m.*, u.display_name AS owner_name
             FROM dna_matches m JOIN users u ON u.id = m.user_id
             WHERE m.kit_id IN ($place)
             ORDER BY m.shared_cm IS NULL, m.shared_cm DESC, m.match_name ASC"
        );
        $stmt->execute($visibleKitIds);
        foreach ($stmt->fetchAll() as $m) {
            $matches[] = [
                'id' => (int)$m['id'],
                'kit_id' => (int)$m['kit_id'],
                'owner_id' => (int)$m['user_id'],
                'owner_name' => (string)$m['owner_name'],
                'match_name' => (string)$m['match_name'],
                'provider' => (string)$m['provider'],
                'predicted_relationship' => (string)$m['predicted_relationship'],
                'shared_surname' => (string)$m['shared_surname'],
                'shared_cm' => $m['shared_cm'] !== null ? (float)$m['shared_cm'] : null,
                'notes' => (string)$m['notes'],
            ];
        }
    }

    send_json(['ok' => true, 'kits' => $kits, 'matches' => $matches, 'isAdmin' => is_admin($me)]);
}

function clean_provider(string $p): string
{
    $p = strtolower(trim($p));
    return in_array($p, PROVIDERS, true) ? $p : 'other';
}

function clean_date(?string $d): ?string
{
    $d = trim((string)$d);
    if ($d === '') return null;
    $t = strtotime($d);
    return $t ? date('Y-m-d', $t) : null;
}

function handleKitCreate(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $provider = clean_provider((string)($body['provider'] ?? 'other'));
    $resultDate = clean_date($body['result_date'] ?? null);
    $visible = array_key_exists('visible_to_members', $body) ? (bool)$body['visible_to_members'] : true;

    $pdo->prepare('INSERT INTO dna_kits (user_id, provider, result_date, visible_to_members) VALUES (?, ?, ?, ?)')
        ->execute([(int)$me['id'], $provider, $resultDate, $visible ? 1 : 0]);
    send_json(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
}

function handleKitUpdate(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) send_error('Missing kit id', 400);
    $kit = get_kit_or_404($pdo, $id);
    if (!is_admin($me) && (int)$kit['user_id'] !== (int)$me['id']) send_error('You can only edit your own kit', 403);

    if (isset($body['provider'])) {
        $kit['provider'] = clean_provider((string)$body['provider']);
    }
    if (array_key_exists('result_date', $body)) {
        $kit['result_date'] = clean_date($body['result_date']);
    }
    $pdo->prepare('UPDATE dna_kits SET provider = ?, result_date = ? WHERE id = ?')
        ->execute([$kit['provider'], $kit['result_date'], $id]);
    send_json(['ok' => true]);
}

function handleKitToggle(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) send_error('Missing kit id', 400);
    $kit = get_kit_or_404($pdo, $id);
    if (!is_admin($me) && (int)$kit['user_id'] !== (int)$me['id']) send_error('You can only hide your own kit', 403);
    $pdo->prepare('UPDATE dna_kits SET visible_to_members = 1 - visible_to_members WHERE id = ?')->execute([$id]);
    $newVal = (int)$pdo->query('SELECT visible_to_members FROM dna_kits WHERE id = ' . (int)$id)->fetchColumn();
    send_json(['ok' => true, 'visible_to_members' => $newVal === 1]);
}

function handleKitDelete(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) send_error('Missing kit id', 400);
    $kit = get_kit_or_404($pdo, $id);
    if (!is_admin($me) && (int)$kit['user_id'] !== (int)$me['id']) send_error('You can only delete your own kit', 403);
    $pdo->prepare('DELETE FROM dna_kits WHERE id = ?')->execute([$id]);
    send_json(['ok' => true]);
}

function handleMatchAdd(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $kitId = (int)($body['kit_id'] ?? 0);
    if ($kitId <= 0) send_error('Pick which kit this match came from', 400);
    $kit = get_kit_or_404($pdo, $kitId);
    if (!is_admin($me) && (int)$kit['user_id'] !== (int)$me['id']) send_error('You can only add matches to your own kit', 403);

    $matchName = trim((string)($body['match_name'] ?? ''));
    if ($matchName === '') send_error('Match name is required', 400);
    if (mb_strlen($matchName) > 255) send_error('Match name is too long', 400);
    $provider = clean_provider((string)($body['provider'] ?? $kit['provider']));
    $relationship = mb_substr(trim((string)($body['predicted_relationship'] ?? '')), 0, 120);
    $surname = mb_substr(trim((string)($body['shared_surname'] ?? '')), 0, 120);
    $notes = mb_substr(trim((string)($body['notes'] ?? '')), 0, 500);
    $sharedCm = null;
    if (isset($body['shared_cm']) && $body['shared_cm'] !== '') {
        $cm = (float)$body['shared_cm'];
        if ($cm < 0 || $cm > 7400) send_error('Shared centimorgans out of range', 400);
        $sharedCm = $cm;
    }

    $pdo->prepare(
        'INSERT INTO dna_matches (kit_id, user_id, match_name, provider, predicted_relationship, shared_surname, shared_cm, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$kitId, (int)$me['id'], $matchName, $provider, $relationship, $surname, $sharedCm, $notes]);
    send_json(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
}

function handleMatchDelete(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) send_error('Missing match id', 400);
    $s = $pdo->prepare('SELECT m.id, m.user_id FROM dna_matches m WHERE m.id = ?');
    $s->execute([$id]);
    $row = $s->fetch();
    if (!$row) send_error('Match not found', 404);
    if (!is_admin($me) && (int)$row['user_id'] !== (int)$me['id']) send_error('You can only delete your own matches', 403);
    $pdo->prepare('DELETE FROM dna_matches WHERE id = ?')->execute([$id]);
    send_json(['ok' => true]);
}
