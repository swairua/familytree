<?php
/**
 * Shared email delivery + official branded templates for TheWairuaHeritage.
 *
 *   require_once __DIR__ . '/mail.php';
 *   $r = app_send_email($pdo, 'member@example.com', 'Welcome!', '<p>Hello</p>');
 *
 *   // Lower level helpers used by other endpoints:
 *   app_brand_email($preheader, $title, $bodyHtml)
 *   app_email_is_real($email)
 *   smtp_settings($pdo)   // key-value array of app_settings smtp_*
 *   smtp_send_raw($cfg, $from, $fromName, $to, $subject, $textBody, $htmlBody)
 *   app_public_url()      // base URL for links (from app_settings)
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

// ---------------------------------------------------------------------------
// Settings access
// ---------------------------------------------------------------------------

function smtp_settings(PDO $pdo): array
{
    $out = [];
    try {
        foreach ($pdo->query('SELECT `key`, `value` FROM app_settings') as $row) {
            $out[$row['key']] = $row['value'];
        }
    } catch (Throwable $e) {
        return [];
    }
    return $out;
}

function app_public_url(PDO $pdo): string
{
    $s = smtp_settings($pdo);
    $url = trim((string)($s['app_public_url'] ?? ''));
    if ($url === '') {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:3000';
        $url = $scheme . '://' . $host;
    }
    return rtrim($url, '/');
}

function email_is_real(string $email): bool
{
    $email = trim($email);
    if ($email === '') return false;
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
    // Imported members carry inert placeholder addresses — never email them.
    if (str_ends_with(strtolower($email), '@placeholder.invalid')) return false;
    return true;
}

function app_unsubscribe_url(PDO $pdo, string $email): ?string
{
    try {
        $stmt = $pdo->prepare('SELECT id, email_unsubscribe_token FROM users WHERE email = ?');
        $stmt->execute([trim($email)]);
        $u = $stmt->fetch();
        if (!$u) return null;
        $token = (string)($u['email_unsubscribe_token'] ?? '');
        if ($token === '') {
            $token = bin2hex(random_bytes(32));
            $pdo->prepare('UPDATE users SET email_unsubscribe_token = ? WHERE id = ?')->execute([$token, $u['id']]);
        }
        return app_public_url($pdo) . '/api/unsubscribe.php?token=' . $token;
    } catch (Throwable $e) {
        return null;
    }
}

function app_notifications_opted_out(PDO $pdo, string $email): bool
{
    try {
        $stmt = $pdo->prepare('SELECT email_notifications FROM users WHERE email = ?');
        $stmt->execute([trim($email)]);
        $v = $stmt->fetchColumn();
        if ($v === false) return false; // not a member account (e.g. admin test send): do not block
        return (int)$v === 0;
    } catch (Throwable $e) {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Branded HTML template (official look: dark utility bar, logo, orange CTA)
// ---------------------------------------------------------------------------
function app_brand_email(string $preheader, string $title, string $bodyHtml, ?string $unsubscribeUrl = null): string
{
    $safePreheader = htmlspecialchars($preheader, ENT_QUOTES, 'UTF-8');
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');

    $mark = '<span style="display:inline-block;width:30px;height:30px;'
        . 'border-radius:50%;border:4px solid #ffffff;box-sizing:border-box;'
        . 'vertical-align:-2px;"></span>';

    $html = <<<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TITLE_PLACEHOLDER</title>
<style>
  @media only screen and (max-width: 480px) {
    .email-wrap { width: 100% !important; max-width: 100% !important; }
    .px { padding-left: 16px !important; padding-right: 16px !important; }
    .px-content { padding: 18px 16px 10px !important; }
    .px-footer { padding: 0 16px 18px !important; }
    .btn-wrap { margin: 18px 0 6px !important; }
    .btn { display: block !important; width: 100% !important; max-width: 100% !important; padding: 14px 16px !important; text-align: center !important; box-sizing: border-box !important; font-size: 16px !important; }
    .title h1 { font-size: 20px !important; }
    .body-text { font-size: 15px !important; }
    .small { font-size: 13px !important; }
  }
  @media only screen and (min-width: 481px) {
    .btn { display: inline-block; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:Georgia,serif;">
<div style="display:none;max-height:0;overflow:hidden;">PREHEADER_PLACEHOLDER</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f1ec;">
<tr>
<td class="px" align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" class="email-wrap" style="width:100%;max-width:560px;">
<tr>
<td style="background:#152a1e;border-radius:10px 10px 0 0;padding:14px 22px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="vertical-align:middle;">MARK_PLACEHOLDER
<span style="color:#ffffff;font-size:17px;font-weight:bold;letter-spacing:0.04em;font-family:Georgia,serif;vertical-align:middle;padding-left:8px;">TheWairuaHeritage</span></td>
<td align="right" style="vertical-align:middle;" class="small"><span style="color:#e08c2e;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;font-family:Arial,sans-serif;">Family Tree</span></td>
</tr></table>
</td>
</tr>
<tr>
<td style="background:#1f3628;padding:16px 22px 18px;" class="title">
<h1 style="color:#f5f3ef;font-family:Georgia,serif;font-size:22px;font-weight:bold;line-height:1.25;margin:0;">TITLE_PLACEHOLDER</h1>
</td>
</tr>
<tr>
<td class="px-content" style="background:#ffffff;padding:24px 26px 10px;border-left:1px solid #e7e2da;border-right:1px solid #e7e2da;color:#2f2b27;font-family:Georgia,serif;font-size:15px;line-height:1.6;">
<div class="body-text">BODY_PLACEHOLDER</div>
</td>
</tr>
<tr>
<td class="px-footer" style="background:#ffffff;padding:0 26px 22px;border-left:1px solid #e7e2da;border-right:1px solid #e7e2da;border-bottom:1px solid #e7e2da;border-radius:0 0 10px 10px;">
<div class="small" style="border-top:1px solid #eee7dc;padding-top:16px;color:#8b837d;font-size:12px;font-family:Arial,sans-serif;line-height:1.6;">
TheWairuaHeritage - Our family, our legacy.
UNSUBSCRIBE_FOOTER
</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
HTML;

    $unsubscribeFooter = '';
    if ($unsubscribeUrl !== null) {
        $safeUnsub = htmlspecialchars($unsubscribeUrl, ENT_QUOTES, 'UTF-8');
        $unsubscribeFooter = '<br>Don&rsquo;t want these emails? '
            . '<a href="' . $safeUnsub . '" style="color:#8b7355;text-decoration:underline;">Unsubscribe</a>'
            . ' or <a href="' . $safeUnsub . '&amp;action=resubscribe" style="color:#8b7355;text-decoration:underline;">manage notifications</a>.';
    }

    $html = str_replace(
        ['TITLE_PLACEHOLDER', 'PREHEADER_PLACEHOLDER', 'MARK_PLACEHOLDER', 'BODY_PLACEHOLDER', 'UNSUBSCRIBE_FOOTER'],
        [$safeTitle, $safePreheader, $mark, $bodyHtml, $unsubscribeFooter],
        $html
    );

    $lines = explode("\n", $html);
    $out = [];
    foreach ($lines as $line) {
        if (strlen($line) > 950) {
            $wrapped = wordwrap($line, 900, "\n", true);
            $out = array_merge($out, explode("\n", $wrapped));
        } else {
            $out[] = $line;
        }
    }
    return implode("\n", $out);
}

function app_button(string $label, string $url): string
{
    return '<p class="btn-wrap" style="text-align:center;margin:22px 0 6px;"><a href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '"'
        . ' class="btn"'
        . ' style="display:inline-block;background:#e08c2e;color:#ffffff;text-decoration:none;'
        . 'font-family:Arial,sans-serif;font-size:15px;font-weight:700;padding:13px 34px;'
        . 'border-radius:24px;letter-spacing:0.02em;">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</a></p>';
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

function app_send_email(PDO $pdo, string $to, string $subject, string $bodyHtml, ?string $bodyText = null, array $extraHeaders = []): array
{
    if (!email_is_real($to)) {
        return ['ok' => false, 'error' => 'Recipient has no deliverable address (placeholder or invalid)'];
    }
    $s = smtp_settings($pdo);
    if (($s['smtp_enabled'] ?? '0') !== '1') {
        return ['ok' => false, 'error' => 'SMTP is disabled in Settings'];
    }
    $from = $s['smtp_from_email'] !== '' ? $s['smtp_from_email'] : ($s['smtp_user'] !== '' ? $s['smtp_user'] : $to);
    $fromName = $s['smtp_from_name'] !== '' ? $s['smtp_from_name'] : 'TheWairuaHeritage';

    $text = $bodyText ?? trim(strip_tags(preg_replace('#<style[^>]*>.*?</style>#isS', '', preg_replace('/<\s*br\s*\/?>/i', "\n", $bodyHtml))));

    return smtp_send_raw($s, $from, $fromName, $to, $subject, $text, $bodyHtml, $extraHeaders);
}

/**
 * Send a branded email.
 *
 * @param string $kind 'transactional' (account/security mail: always delivered,
 *                      opt-out ignored) or 'notification' (messages, birthdays,
 *                      digests: suppressed when the member has unsubscribed).
 *                      Every branded email carries an unsubscribe link +
 *                      List-Unsubscribe headers regardless of kind.
 */
function app_send_branded(PDO $pdo, string $to, string $subject, string $preheader, string $title, string $bodyHtml, ?string $bodyText = null, string $kind = 'transactional'): array
{
    $unsubscribeUrl = app_unsubscribe_url($pdo, $to);
    if ($kind === 'notification' && app_notifications_opted_out($pdo, $to)) {
        return ['ok' => false, 'skipped' => true, 'error' => 'Member has unsubscribed from notification emails'];
    }
    $headers = [];
    if ($unsubscribeUrl !== null) {
        $headers[] = 'List-Unsubscribe: <' . $unsubscribeUrl . '>';
        $headers[] = 'List-Unsubscribe-Post: List-Unsubscribe=One-Click';
    }
    $text = $bodyText;
    if ($text === null && $unsubscribeUrl !== null) {
        $text = trim(strip_tags(preg_replace('#<style[^>]*>.*?</style>#isS', '', preg_replace('/<\s*br\s*\/?>/i', "\n", $bodyHtml))))
            . "\n\nUnsubscribe: " . $unsubscribeUrl;
    }
    return app_send_email($pdo, $to, $subject, app_brand_email($preheader, $title, $bodyHtml, $unsubscribeUrl), $text, $headers);
}

// ---------------------------------------------------------------------------
// Raw SMTP client (STARTTLS / SSL / none + AUTH LOGIN), multipart/alternative
// ---------------------------------------------------------------------------

function smtp_send_raw(array $cfg, string $from, string $fromName, string $to, string $subject, string $textBody, ?string $htmlBody = null, array $extraHeaders = []): array
{
    $host = trim((string)($cfg['smtp_host'] ?? ''));
    if ($host === '') return ['ok' => false, 'error' => 'SMTP host is empty'];
    $port = (int)($cfg['smtp_port'] ?? 587);
    $scheme = strtolower((string)($cfg['smtp_scheme'] ?? 'tls'));
    $user = trim((string)($cfg['smtp_user'] ?? ''));
    $pass = (string)($cfg['smtp_pass'] ?? '');

    $remote = ($scheme === 'ssl') ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
    $ctx = stream_context_create([
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true],
    ]);
    $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        return ['ok' => false, 'error' => "Could not connect to {$remote} ({$errstr}, code {$errno})"];
    }
    stream_set_timeout($fp, 20);

    $readResponse = static function () use ($fp): ?array {
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
    $cmd = static fn ($fp, string $line) => fwrite($fp, $line . "\r\n");
    $clean = static fn (string $s) => str_replace(["\r", "\n"], ' ', $s);

    try {
        $hello = $readResponse();
        if (!$hello || $hello[0] !== 220) {
            return ['ok' => false, 'error' => 'Server did not respond with 220'];
        }
        $cmd($fp, 'EHLO ' . (gethostname() ?: 'localhost'));
        $hello = $readResponse();
        if (!$hello || $hello[0] !== 250) {
            $cmd($fp, 'HELO ' . (gethostname() ?: 'localhost'));
            $hello = $readResponse();
            if (!$hello || $hello[0] !== 250) {
                return ['ok' => false, 'error' => 'EHLO/HELO rejected'];
            }
        }
        if ($scheme === 'tls') {
            $cmd($fp, 'STARTTLS');
            $r = $readResponse();
            if (!$r || $r[0] !== 220) return ['ok' => false, 'error' => 'STARTTLS rejected by server'];
            if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                return ['ok' => false, 'error' => 'TLS negotiation failed'];
            }
            $cmd($fp, 'EHLO ' . (gethostname() ?: 'localhost'));
            $r = $readResponse();
            if (!$r || $r[0] !== 250) return ['ok' => false, 'error' => 'EHLO after STARTTLS rejected'];
        }
        if ($user !== '') {
            $cmd($fp, 'AUTH LOGIN');
            $r = $readResponse();
            if (!$r || $r[0] !== 334) return ['ok' => false, 'error' => 'AUTH LOGIN rejected'];
            $cmd($fp, base64_encode($user));
            $r = $readResponse();
            if (!$r || $r[0] !== 334) return ['ok' => false, 'error' => 'Username rejected'];
            $cmd($fp, base64_encode($pass));
            $r = $readResponse();
            if (!$r || $r[0] !== 235) return ['ok' => false, 'error' => 'Authentication failed'];
        }
        $cmd($fp, 'MAIL FROM:<' . $clean($from) . '>');
        $r = $readResponse();
        if (!$r || $r[0] !== 250) return ['ok' => false, 'error' => 'MAIL FROM rejected'];
        $cmd($fp, 'RCPT TO:<' . $clean($to) . '>');
        $r = $readResponse();
        if (!$r || ($r[0] !== 250 && $r[0] !== 251)) return ['ok' => false, 'error' => 'RCPT TO rejected'];
        $cmd($fp, 'DATA');
        $r = $readResponse();
        if (!$r || $r[0] !== 354) return ['ok' => false, 'error' => 'DATA rejected'];

        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $headers = [
            'From: ' . $clean($fromName) . ' <' . $clean($from) . '>',
            'To: ' . $clean($to),
            'Subject: ' . $encodedSubject,
            'MIME-Version: 1.0',
            'Date: ' . date(DATE_RFC2822),
        ];
        foreach ($extraHeaders as $h) {
            $h = trim((string)$h);
            if ($h !== '' && strpos($h, "\r") === false && strpos($h, "\n") === false) {
                $headers[] = $h;
            }
        }

        if ($htmlBody) {
            $boundary = '=_b_' . bin2hex(random_bytes(8));
            $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
            $body = "--{$boundary}\r\n"
                . "Content-Type: text/plain; charset=UTF-8\r\n"
                . "Content-Transfer-Encoding: 8bit\r\n\r\n"
                . str_replace(["\r\n", "\n"], ["\r\n", "\r\n"], $textBody) . "\r\n"
                . "--{$boundary}\r\n"
                . "Content-Type: text/html; charset=UTF-8\r\n"
                . "Content-Transfer-Encoding: 8bit\r\n\r\n"
                . $htmlBody . "\r\n"
                . "--{$boundary}--\r\n";
        } else {
            $headers[] = 'Content-Type: text/plain; charset=UTF-8';
            $headers[] = 'Content-Transfer-Encoding: 8bit';
            $body = str_replace(["\r\n", "\n"], ["\r\n", "\r\n"], $textBody) . "\r\n";
        }

        $message = implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.\r\n";
        // Hard safety net: cap every line at 990 bytes so Exim accepts it
        $safeLines = [];
        foreach (explode("\r\n", $message) as $line) {
            while (strlen($line) > 990) {
                $safeLines[] = substr($line, 0, 990);
                $line = substr($line, 990);
            }
            $safeLines[] = $line;
        }
        $message = implode("\r\n", $safeLines);
        fwrite($fp, $message);
        $r = $readResponse();
        if (!$r || $r[0] !== 250) return ['ok' => false, 'error' => 'Message rejected by server'];
        $cmd($fp, 'QUIT');
        fclose($fp);
        return ['ok' => true];
    } catch (Throwable $e) {
        @fclose($fp);
        return ['ok' => false, 'error' => 'SMTP error: ' . $e->getMessage()];
    }
}
