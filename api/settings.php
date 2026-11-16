<?php
/**
 * Admin settings endpoint (SMTP configuration, public URL, test email).
 *
 *   GET  settings.php?action=get        (admin)        → current settings (password masked)
 *   POST settings.php?action=set        (admin)        → update settings
 *   POST settings.php?action=send-test  (admin)        → send a branded test email
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mail.php';

send_cors_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = db();
    $action = $_GET['action'] ?? 'get';
    // Inline admin gate (settings.php does not load auth.php to avoid running its routes)
    if (session_status() === PHP_SESSION_NONE) {
        session_name('FAMILYTREE_SESSION');
        session_start();
    }
    $uid = $_SESSION['user_id'] ?? null;
    $admin = null;
    if ($uid) {
        $stmt = $pdo->prepare('SELECT id, email, role FROM users WHERE id = ?');
        $stmt->execute([$uid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && ($row['role'] ?? '') === 'admin') $admin = $row;
    }
    if (!$admin) send_error('Administrator access required', 403);

    switch ($action) {
        case 'get':
            handleGet($pdo, $admin);
            break;
        case 'set':
            handleSet($pdo);
            break;
        case 'send-test':
            handleSendTest($pdo, $admin);
            break;
        default:
            send_error("Unknown action: {$action}", 404);
    }
} catch (Throwable $e) {
    send_error('Server error: ' . $e->getMessage(), 500);
}

// ---------------------------------------------------------------------------

function all_settings(PDO $pdo): array
{
    $out = [];
    foreach ($pdo->query('SELECT `key`, `value` FROM app_settings') as $row) {
        $out[$row['key']] = $row['value'];
    }
    return $out;
}

function handleGet(PDO $pdo, array $admin): void
{
    $s = all_settings($pdo);
    $masked = $s;
    $masked['smtp_pass'] = $s['smtp_pass'] !== '' ? 'SET' : '';
    send_json([
        'ok' => true,
        'settings' => $masked,
        'adminEmail' => $admin['email'],
    ]);
}

function handleSet(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();

    $update = [];
    if (array_key_exists('smtp_enabled', $body)) {
        $update['smtp_enabled'] = $body['smtp_enabled'] ? '1' : '0';
    }
    foreach (['smtp_host', 'smtp_user', 'smtp_from_email', 'smtp_from_name', 'app_public_url'] as $k) {
        if (array_key_exists($k, $body) && is_string($body[$k])) {
            $update[$k] = trim(mb_substr($body[$k], 0, 255));
        }
    }
    if (array_key_exists('smtp_port', $body)) {
        $port = (int)$body['smtp_port'];
        if ($port < 1 || $port > 65535) send_error('Port must be between 1 and 65535', 400);
        $update['smtp_port'] = (string)$port;
    }
    if (array_key_exists('smtp_scheme', $body)) {
        $scheme = strtolower((string)$body['smtp_scheme']);
        if (!in_array($scheme, ['tls', 'ssl', 'none'], true)) send_error('Scheme must be tls, ssl or none', 400);
        $update['smtp_scheme'] = $scheme;
    }
    // Password: empty string clears it; a real value sets it; missing/absent leaves untouched
    if (array_key_exists('smtp_pass', $body)) {
        $pass = (string)$body['smtp_pass'];
        if ($pass === '') {
            $update['smtp_pass'] = '';
        } elseif ($pass !== 'CHANGED') {
            $update['smtp_pass'] = $pass;
        }
    }
    if (!empty($update)) {
        $stmt = $pdo->prepare('INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
        foreach ($update as $k => $v) {
            $stmt->execute([$k, $v]);
        }
    }
    send_json(['ok' => true, 'settings' => all_settings($pdo)]);
}

function handleSendTest(PDO $pdo, array $admin): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $s = all_settings($pdo);
    if (($s['smtp_enabled'] ?? '0') !== '1') {
        send_error('SMTP is disabled — enable it above before sending a test email.', 400);
    }

    $body = read_json_body();
    $to = trim((string)($body['to'] ?? ''));
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        send_error('Enter a valid recipient address', 400);
    }

    $result = app_send_branded(
        $pdo,
        $to,
        'TheWairuaHeritage SMTP test',
        'SMTP test — delivery is working',
        'SMTP is configured',
        '<p>Hi ' . htmlspecialchars($admin['email'], ENT_QUOTES, 'UTF-8') . ',</p>'
        . '<p>This message was sent from <strong>TheWairuaHeritage</strong> at <strong>' . date('Y-m-d H:i:s') . '</strong> '
        . 'to verify the SMTP configuration on the Settings page.</p>'
        . '<p>If you received it, email is working for member invites and password resets.</p>'
        . app_button('Open TheWairuaHeritage', app_public_url($pdo))
        . '<p style="font-size:13px;color:#8b837d;">Sent by the site administrator from the Settings &rarr; SMTP section.</p>'
    );

    if (!$result['ok']) {
        send_error('Test email failed: ' . $result['error'], 502);
    }
    send_json(['ok' => true]);
}
