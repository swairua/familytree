<?php
/**
 * Admin settings endpoint (SMTP configuration and test).
 *
 *   GET  settings.php?action=get        (admin)        → current settings (password masked)
 *   POST settings.php?action=set        (admin)        → update settings
 *   POST settings.php?action=send-test  (admin)        → send a test email
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

send_cors_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = db();
    $action = $_GET['action'] ?? 'get';
    $u = session_user_or_401($pdo);
    if (($u['role'] ?? '') !== 'admin') send_error('Administrator access required', 403);

    switch ($action) {
        case 'get':
            handleGet($pdo, $u);
            break;
        case 'set':
            handleSet($pdo);
            break;
        case 'send-test':
            handleSendTest($pdo, $u);
            break;
        default:
            send_error("Unknown action: {$action}", 404);
    }
} catch (Throwable $e) {
    send_error('Server error: ' . $e->getMessage(), 500);
}

// ---------------------------------------------------------------------------

const SMTP_KEYS = [
    'smtp_enabled',
    'smtp_host',
    'smtp_port',
    'smtp_scheme',
    'smtp_user',
    'smtp_pass',
    'smtp_from_email',
    'smtp_from_name',
];

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
    foreach (['smtp_host', 'smtp_user', 'smtp_from_email', 'smtp_from_name'] as $k) {
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

    $from = $s['smtp_from_email'] !== '' ? $s['smtp_from_email'] : ($s['smtp_user'] !== '' ? $s['smtp_user'] : $admin['email']);
    $fromName = $s['smtp_from_name'] !== '' ? $s['smtp_from_name'] : 'TheWairuaHeritage';

    $result = smtp_send($s, $from, $fromName, $to, 'TheWairuaHeritage SMTP test',
        "This is a test email sent from TheWairuaHeritage\n"
        . "at " . date('Y-m-d H:i:s') . ".\n\nIf you received this, email is configured correctly for password-reset and member invites.\n");

    if (!$result['ok']) {
        send_error('Test email failed: ' . $result['error'], 502);
    }
    send_json(['ok' => true]);
}

// ---------------------------------------------------------------------------
// Minimal SMTP client: supports STARTTLS (scheme=tls), direct SSL (scheme=ssl),
// plain text (none), plus AUTH LOGIN.
// ---------------------------------------------------------------------------

function smtp_send(array $cfg, string $from, string $fromName, string $to, string $subject, string $textBody): array
{
    $host = trim((string)($cfg['smtp_host'] ?? ''));
    if ($host === '') return ['ok' => false, 'error' => 'SMTP host is empty'];
    $port = (int)($cfg['smtp_port'] ?? 587);
    $scheme = strtolower((string)($cfg['smtp_scheme'] ?? 'tls'));
    $user = trim((string)($cfg['smtp_user'] ?? ''));
    $pass = (string)($cfg['smtp_pass'] ?? '');

    $remote = ($scheme === 'ssl') ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
    $ctx = stream_context_create([
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true,
        ],
    ]);
    $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        return ['ok' => false, 'error' => "Could not connect to {$remote} ({$errstr}, code {$errno})"];
    }
    stream_set_timeout($fp, 20);

    $readLine = static function () use ($fp): string {
        $line = fgets($fp, 515);
        return $line === false ? '' : $line;
    };
    $readResponse = static function () use ($fp): ?array {
        // Read one response (possibly multi-line) per RFC 5321: lines are "code-text", last is "code text"
        $code = null;
        $text = '';
        for ($i = 0; $i < 50; $i++) {
            $line = fgets($fp, 1024);
            if ($line === false) return null;
            $code = (int)substr($line, 0, 3);
            $sep = substr($line, 3, 1);
            $text .= substr($line, 4);
            if ($sep === ' ') break;
        }
        return [$code, trim($text)];
    };
    $cmd = static function ($fp, string $line) {
        fwrite($fp, $line . "\r\n");
    };
    $clean = static fn (string $s) => str_replace(["\r", "\n"], ' ', $s);

    try {
        $hello = $readResponse();
        if (!$hello || $hello[0] !== 220) {
            return ['ok' => false, 'error' => 'Server did not respond with 220 (got ' . ($hello[0] ?? 'nothing') . ')'];
        }
        $cmd($fp, 'EHLO ' . gethostname());
        $hello = $readResponse();
        if (!$hello || $hello[0] !== 250) {
            // Fall back to plain HELO
            $cmd($fp, 'HELO ' . gethostname());
            $hello = $readResponse();
            if (!$hello || $hello[0] !== 250) {
                return ['ok' => false, 'error' => 'EHLO/HELO rejected'];
            }
        }
        if ($scheme === 'tls') {
            $cmd($fp, 'STARTTLS');
            $r = $readResponse();
            if (!$r || $r[0] !== 220) {
                return ['ok' => false, 'error' => 'STARTTLS rejected by server'];
            }
            if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                return ['ok' => false, 'error' => 'TLS negotiation failed'];
            }
            $cmd($fp, 'EHLO ' . gethostname());
            $r = $readResponse();
            if (!$r || $r[0] !== 250) {
                return ['ok' => false, 'error' => 'EHLO after STARTTLS rejected'];
            }
        }
        if ($user !== '') {
            $cmd($fp, 'AUTH LOGIN');
            $r = $readResponse();
            if (!$r || $r[0] !== 334) {
                return ['ok' => false, 'error' => 'AUTH LOGIN rejected (check username)'];
            }
            $cmd($fp, base64_encode($user));
            $r = $readResponse();
            if (!$r || $r[0] !== 334) {
                return ['ok' => false, 'error' => 'Username rejected'];
            }
            $cmd($fp, base64_encode($pass));
            $r = $readResponse();
            if (!$r || $r[0] !== 235) {
                return ['ok' => false, 'error' => 'Authentication failed (check password)'];
            }
        }
        $cmd($fp, 'MAIL FROM:<' . $clean($from) . '>');
        $r = $readResponse();
        if (!$r || $r[0] !== 250) {
            return ['ok' => false, 'error' => 'MAIL FROM rejected'];
        }
        $cmd($fp, 'RCPT TO:<' . $clean($to) . '>');
        $r = $readResponse();
        if (!$r || ($r[0] !== 250 && $r[0] !== 251)) {
            return ['ok' => false, 'error' => 'RCPT TO rejected for ' . $clean($to)];
        }
        $cmd($fp, 'DATA');
        $r = $readResponse();
        if (!$r || $r[0] !== 354) {
            return ['ok' => false, 'error' => 'DATA rejected'];
        }
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $headers = [
            'From: ' . $clean($fromName) . ' <' . $clean($from) . '>',
            'To: ' . $clean($to),
            'Subject: ' . $encodedSubject,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            'Date: ' . date(DATE_RFC2822),
        ];
        $message = implode("\r\n", $headers) . "\r\n\r\n"
            . str_replace(["\r\n", "\n"], ["\r\n", "\r\n"], $textBody)
            . "\r\n.\r\n";
        fwrite($fp, $message);
        $r = $readResponse();
        if (!$r || $r[0] !== 250) {
            return ['ok' => false, 'error' => 'Message rejected by server'];
        }
        $cmd($fp, 'QUIT');
        fclose($fp);
        return ['ok' => true];
    } catch (Throwable $e) {
        @fclose($fp);
        return ['ok' => false, 'error' => 'SMTP error: ' . $e->getMessage()];
    }
}
