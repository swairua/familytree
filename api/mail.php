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

// ---------------------------------------------------------------------------
// Branded HTML template (official look: dark utility bar, logo, orange CTA)
// ---------------------------------------------------------------------------

function app_brand_email(string $preheader, string $title, string $bodyHtml): string
{
    $safePreheader = htmlspecialchars($preheader, ENT_QUOTES, 'UTF-8');
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    // Very wide preheader padding so the snippet still shows without extra copy
    $preheaderPad = str_repeat("\u{200B}\u{200C}\u{200D}\u{200E}\u{200F}\u{FEFF}", 60);

    $mark = '<span style="display:inline-block;width:30px;height:30px;border-radius:50%;'
        . 'border:4px solid #ffffff;box-sizing:border-box;vertical-align:-2px;"></span>';

    return '<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>' . $safeTitle . '</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:Georgia,\'Times New Roman\',serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">' . $safePreheader . $preheaderPad . '</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f1ec;">
  <tr>
    <td align="center" style="padding:28px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;">

        <!-- Brand header -->
        <tr>
          <td style="background:#152a1e;border-radius:10px 10px 0 0;padding:14px 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;">' . $mark . '
                  <span style="color:#ffffff;font-size:17px;font-weight:bold;letter-spacing:0.04em;font-family:Georgia,serif;vertical-align:middle;padding-left:8px;">TheWairuaHeritage</span>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="color:#e08c2e;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;font-family:Arial,sans-serif;">Family Tree</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Title banner -->
        <tr>
          <td style="background:#1f3628;padding:16px 22px 18px;">
            <div style="color:#f5f3ef;font-family:Georgia,serif;font-size:22px;font-weight:bold;line-height:1.25;">' . $safeTitle . '</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:24px 26px 10px;border-left:1px solid #e7e2da;border-right:1px solid #e7e2da;color:#2f2b27;font-family:Georgia,serif;font-size:15px;line-height:1.6;">
            ' . $bodyHtml . '
          </td>
        </tr>

        <!-- CTA row: preheader spacing if any buttons added in body -->
        <tr>
          <td style="background:#ffffff;padding:0 26px 22px;border-left:1px solid #e7e2da;border-right:1px solid #e7e2da;border-bottom:1px solid #e7e2da;border-radius:0 0 10px 10px;">
            <div style="border-top:1px solid #eee7dc;padding-top:16px;color:#8b837d;font-size:12.5px;font-family:Arial,sans-serif;line-height:1.5;">
              TheWairuaHeritage · Our family, our legacy.<br>
              This message was sent automatically — please do not reply.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>';
}

function app_button(string $label, string $url): string
{
    return '<p style="text-align:center;margin:22px 0 6px;">
  <a href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '"'
        . ' style="display:inline-block;background:#e08c2e;color:#ffffff;text-decoration:none;'
        . 'font-family:Arial,sans-serif;font-size:15px;font-weight:700;padding:13px 34px;'
        . 'border-radius:24px;letter-spacing:0.02em;">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</a>
</p>';
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

function app_send_email(PDO $pdo, string $to, string $subject, string $bodyHtml, ?string $bodyText = null): array
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

    $text = $bodyText ?? trim(strip_tags(preg_replace('/<\s*br\s*\/?>/i', "\n", $bodyHtml)));

    return smtp_send_raw($s, $from, $fromName, $to, $subject, $text, $bodyHtml);
}

function app_send_branded(PDO $pdo, string $to, string $subject, string $preheader, string $title, string $bodyHtml, ?string $bodyText = null): array
{
    return app_send_email($pdo, $to, $subject, app_brand_email($preheader, $title, $bodyHtml), $bodyText);
}

// ---------------------------------------------------------------------------
// Raw SMTP client (STARTTLS / SSL / none + AUTH LOGIN), multipart/alternative
// ---------------------------------------------------------------------------

function smtp_send_raw(array $cfg, string $from, string $fromName, string $to, string $subject, string $textBody, ?string $htmlBody = null): array
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
