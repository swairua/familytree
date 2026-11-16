<?php
/**
 * FamilySearch integration (OAuth 2.0 authorization-code + PKCE).
 *
 * Per-member link: each member authorizes with their own FamilySearch
 * account; we store only their access token server-side (table fs_tokens)
 * and proxy the Family Tree search API — nothing is stored about records
 * themselves.
 *
 *   GET  ?action=status     -> { ok, configured, env, connected, expiresAt, connectUrl }
 *   GET  ?action=connect    -> 302 to FamilySearch authorization page
 *   GET  ?action=callback   -> exchange code, store token, 302 back to the app
 *   POST ?action=disconnect
 *   GET  ?action=search&given=&surname=&birthYear=&place=&count=20
 *
 * Configuration (api/config.local.php, git-ignored):
 *   'familysearch_key' => 'ABCD-EF12-...',   // app key from familysearch.org developer center
 *   'familysearch_env' => 'beta',            // 'beta' (default) or 'production'
 *
 * Without a key, status reports configured=false and every action except
 * status degrades gracefully. Production keys require FamilySearch's
 * Compatible Solution review (https://developers.familysearch.org).
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_lib.php';
require_once __DIR__ . '/mail.php'; // app_public_url()

send_cors_headers();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------------
// Config / environment
// ---------------------------------------------------------------------------

function fs_config(): array
{
    $local = [];
    $file = __DIR__ . '/config.local.php';
    if (is_file($file)) {
        $local = require $file;
    }
    $key = trim((string)($local['familysearch_key'] ?? ''));
    $env = strtolower(trim((string)($local['familysearch_env'] ?? 'beta')));
    if (!in_array($env, ['beta', 'production'], true)) {
        $env = 'beta';
    }
    return ['key' => $key, 'env' => $env, 'configured' => $key !== ''];
}

function fs_host(array $cfg): array
{
    return $cfg['env'] === 'production'
        ? ['identity' => 'https://ident.familysearch.org/cis-web',
           'api'      => 'https://api.familysearch.org/platform',
           'membersUrl' => 'https://www.familysearch.org']
        : ['identity' => 'https://identbeta.familysearch.org/cis-web',
           'api'      => 'https://apibeta.familysearch.org/platform',
           'membersUrl' => 'https://beta.familysearch.org'];
}

function fs_redirect_uri(PDO $pdo): string
{
    return app_public_url($pdo) . '/api/familysearch.php?action=callback';
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function fs_http(string $method, string $url, ?array $headers = null, ?array $form = null, ?string $bearer = null, int $timeout = 20): array
{
    $ch = curl_init($url);
    $hdrs = $headers ?? [];
    if ($bearer !== null) {
        $hdrs[] = 'Authorization: Bearer ' . $bearer;
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => $hdrs,
    ]);
    if ($form !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($form));
    }
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return [$code, (string)$body, $err];
}

// ---------------------------------------------------------------------------
// Token storage (one per member)
// ---------------------------------------------------------------------------

function fs_current_token(PDO $pdo, int $userId): ?array
{
    $s = $pdo->prepare('SELECT access_token, expires_at FROM fs_tokens WHERE user_id = ?');
    $s->execute([$userId]);
    $row = $s->fetch();
    if (!$row) return null;
    return [
        'access_token' => (string)$row['access_token'],
        'expires_at' => (string)$row['expires_at'],
        'fresh' => strtotime((string)$row['expires_at']) > time(),
    ];
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

try {
    $pdo = db();
    $me = require_active_session_user($pdo);
    $uid = (int)$me['id'];
    $cfg = fs_config();
    $host = fs_host($cfg);
    $action = $_GET['action'] ?? 'status';

    switch ($action) {
        case 'status':
            handleStatus($pdo, $me, $cfg, $host);
            break;
        case 'connect':
            handleConnect($pdo, $me, $cfg, $host);
            break;
        case 'callback':
            handleCallback($pdo, $me, $cfg, $host);
            break;
        case 'disconnect':
            handleDisconnect($pdo, $me);
            break;
        case 'search':
            handleSearch($pdo, $me, $cfg, $host);
            break;
        default:
            send_error('Unknown action ' . $action, 404);
    }
} catch (Throwable $e) {
    send_error('Server error: ' . $e->getMessage(), 500);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleStatus(PDO $pdo, array $me, array $cfg, array $host): void
{
    $tok = fs_current_token($pdo, (int)$me['id']);
    send_json([
        'ok' => true,
        'configured' => $cfg['configured'],
        'env' => $cfg['env'],
        'membersUrl' => $host['membersUrl'],
        'connected' => $tok !== null && $tok['fresh'],
        'expiresAt' => $tok['expires_at'] ?? null,
        'connectUrl' => $cfg['configured'] ? app_public_url($pdo) . '/api/familysearch.php?action=connect' : null,
    ]);
}

function handleConnect(PDO $pdo, array $me, array $cfg, array $host): void
{
    if (!$cfg['configured']) {
        send_error('FamilySearch is not configured on this site (missing app key) — ask the site administrator.', 503);
    }
    start_fs_session();

    $verifier = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    $state = bin2hex(random_bytes(16));

    $_SESSION['fs_code_verifier'] = $verifier;
    $_SESSION['fs_state'] = $state;

    $query = http_build_query([
        'response_type' => 'code',
        'client_id' => $cfg['key'],
        'redirect_uri' => fs_redirect_uri($pdo),
        'state' => $state,
        'code_challenge' => $challenge,
        'code_challenge_method' => 'S256',
    ]);
    header('Location: ' . $host['identity'] . '/oauth2/v3/authorization?' . $query);
    http_response_code(302);
    exit;
}

function handleCallback(PDO $pdo, array $me, array $cfg, array $host): void
{
    start_fs_session();

    $error = (string)($_GET['error'] ?? '');
    if ($error !== '') {
        $desc = (string)($_GET['error_description'] ?? $error);
        fail_redirect($pdo, 'FamilySearch sign-in failed: ' . $desc);
    }
    $code = trim((string)($_GET['code'] ?? ''));
    $state = (string)($_GET['state'] ?? '');
    $expectedState = (string)($_SESSION['fs_state'] ?? '');
    $verifier = (string)($_SESSION['fs_code_verifier'] ?? '');

    // Single-use state + verifier
    unset($_SESSION['fs_state'], $_SESSION['fs_code_verifier']);

    if ($code === '' || $state === '' || !hash_equals($expectedState, $state)) {
        fail_redirect($pdo, 'FamilySearch sign-in state did not match — please try again.');
    }
    if (!$cfg['configured']) {
        fail_redirect($pdo, 'FamilySearch is not configured on this site.');
    }

    [$code_, $body, $err] = fs_http('POST', $host['identity'] . '/oauth2/v3/token',
        ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
        [
            'code' => $code,
            'grant_type' => 'authorization_code',
            'client_id' => $cfg['key'],
            'redirect_uri' => fs_redirect_uri($pdo),
            'code_verifier' => $verifier,
        ]);
    $payload = json_decode($body, true);
    if ($code_ !== 200 || empty($payload['access_token'])) {
        $msg = is_array($payload) ? (string)($payload['error_description'] ?? $payload['error'] ?? 'unknown') : ($err ?: 'HTTP ' . $code_);
        fail_redirect($pdo, 'FamilySearch token exchange failed: ' . $msg);
    }
    $token = (string)$payload['access_token'];
    $tokenType = (string)($payload['token_type'] ?? 'family_search');
    // FS tokens expire 24h after issue or after 60 idle minutes; be conservative
    $pdo->prepare(
        'INSERT INTO fs_tokens (user_id, access_token, token_type, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL 23 HOUR)
         ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), token_type = VALUES(token_type), expires_at = VALUES(expires_at)'
    )->execute([(int)$me['id'], $token, $tokenType]);

    header('Location: ' . app_public_url($pdo) . '/?view=research&fs=connected');
    http_response_code(303);
    exit;
}

function handleDisconnect(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        send_error('Use POST', 405);
    }
    $pdo->prepare('DELETE FROM fs_tokens WHERE user_id = ?')->execute([(int)$me['id']]);
    send_json(['ok' => true]);
}

function handleSearch(PDO $pdo, array $me, array $cfg, array $host): void
{
    if (!$cfg['configured']) {
        send_error('FamilySearch is not configured on this site — ask the site administrator.', 503);
    }
    $tok = fs_current_token($pdo, (int)$me['id']);
    if (!$tok) {
        send_json(['ok' => false, 'error' => 'not_connected', 'message' => 'Connect your FamilySearch account first.'], 401);
    }
    if (!$tok['fresh']) {
        $pdo->prepare('DELETE FROM fs_tokens WHERE user_id = ?')->execute([(int)$me['id']]);
        send_json(['ok' => false, 'error' => 'expired', 'message' => 'Your FamilySearch session expired — connect again.'], 401);
    }

    $given = trim((string)($_GET['given'] ?? ''));
    $surname = trim((string)($_GET['surname'] ?? ''));
    $year = trim((string)($_GET['birthYear'] ?? ''));
    $place = trim((string)($_GET['place'] ?? ''));
    $count = max(1, min(50, (int)($_GET['count'] ?? 20)));

    $q = [];
    if ($given !== '') $q['q.givenName'] = $given;
    if ($surname !== '') $q['q.surname'] = $surname;
    if ($year !== '' && preg_match('/^\d{4}/', $year)) $q['q.birthLikeDate'] = substr($year, 0, 4);
    if ($place !== '') $q['q.birthLikePlace'] = $place;
    if (!$q) {
        send_error('Add at least a name, birth year or place to search.', 400);
    }
    $q['count'] = (string)$count;

    [$code_, $body, $err] = fs_http('GET', $host['api'] . '/tree/search?' . http_build_query($q),
        ['Accept: application/x-gedcomx-atom+json, application/json'], null, $tok['access_token']);

    if ($code_ === 204) {
        send_json(['ok' => true, 'results' => [], 'count' => 0]);
    }
    if ($code_ === 401 || $code_ === 403) {
        $pdo->prepare('DELETE FROM fs_tokens WHERE user_id = ?')->execute([(int)$me['id']]);
        send_json(['ok' => false, 'error' => 'expired', 'message' => 'FamilySearch rejected the session — connect again.'], 401);
    }
    if ($code_ === 429) {
        send_error('FamilySearch throttled the request — please wait a moment and try again.', 429);
    }
    if ($code_ !== 200) {
        send_error('FamilySearch returned HTTP ' . $code_ . ($err ? ' (' . $err . ')' : ''), 502);
    }

    $data = json_decode($body, true);
    $results = normalize_fs_results(is_array($data) ? $data : []);
    send_json(['ok' => true, 'results' => $results, 'count' => count($results)]);
}

function normalize_fs_results(array $data): array
{
    $entries = [];
    // Atom+JSON (default): entries[].content[].person ; plain JSON: persons[]
    if (isset($data['entries']) && is_array($data['entries'])) {
        foreach ($data['entries'] as $entry) {
            $content = $entry['content'] ?? [];
            if (isset($content['person']) && is_array($content['person'])) {
                $entries[] = $content['person'];
            } elseif (is_array($content)) {
                foreach ($content as $item) {
                    if (isset($item['person']) && is_array($item['person'])) $entries[] = $item['person'];
                }
            }
        }
    } elseif (isset($data['persons']) && is_array($data['persons'])) {
        $entries = $data['persons'];
    }

    $out = [];
    foreach ($entries as $p) {
        $out[] = [
            'id' => (string)($p['id'] ?? ''),
            'name' => fs_person_name($p),
            'gender' => (string)($p['gender']['type'] ?? ''),
            'birthYear' => fs_fact_value($p, 'Birth', 'year'),
            'birthDate' => fs_fact_value($p, 'Birth', 'original'),
            'birthPlace' => fs_fact_value($p, 'Birth', 'place'),
            'deathYear' => fs_fact_value($p, 'Death', 'year'),
            'ark' => fs_ark($p),
        ];
        if (count($out) >= 50) break;
    }
    return $out;
}

function fs_person_name(array $p): string
{
    foreach (($p['names'] ?? []) as $name) {
        foreach (($name['nameForms'] ?? []) as $form) {
            $given = '';
            $surname = '';
            foreach (($form['parts'] ?? []) as $part) {
                $type = (string)($part['type'] ?? '');
                $value = (string)($part['value'] ?? '');
                if ($value === '') continue;
                if (str_ends_with($type, '#Given')) $given .= ($given ? ' ' : '') . $value;
                elseif (str_ends_with($type, '#Surname') || str_ends_with($type, '#Family')) $surname .= ($surname ? ' ' : '') . $value;
            }
            $full = trim($given . ' ' . $surname);
            if ($full !== '') return $full;
            if (isset($form['fullText'])) return (string)$form['fullText'];
        }
        if (isset($name['nameForms'][0]['fullText'])) return (string)$name['nameForms'][0]['fullText'];
    }
    return (string)($p['id'] ?? 'Unknown');
}

function fs_fact_value(array $p, string $kind, string $which): ?string
{
    foreach (($p['facts'] ?? []) as $fact) {
        $type = (string)($fact['type'] ?? '');
        if (!str_ends_with($type, '#' . $kind)) continue;
        if ($which === 'place') {
            return (string)($fact['place']['original'] ?? $fact['place']['description'] ?? '') ?: null;
        }
        $date = $fact['date'] ?? null;
        if (is_array($date)) {
            return (string)($date[$which] ?? $date['original'] ?? '') ?: null;
        }
    }
    return null;
}

function fs_ark(array $p): ?string
{
    $identifiers = $p['identifiers'] ?? [];
    if (isset($identifiers['http://gedcomx.org/Persistent'][0])) {
        return (string)$identifiers['http://gedcomx.org/Persistent'][0];
    }
    return null;
}

function start_fs_session(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name('FAMILYTREE_SESSION');
        session_start();
    }
}

function fail_redirect(PDO $pdo, string $message): void
{
    header('Location: ' . app_public_url($pdo) . '/?view=research&fs=error&msg=' . rawurlencode($message));
    http_response_code(303);
    exit;
}
