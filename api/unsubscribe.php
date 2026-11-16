<?php
/**
 * One-click email unsubscribe / resubscribe for TheWairuaHeritage members.
 *
 *   GET  unsubscribe.php?token=<64 hex>                 -> confirmation page
 *   GET  unsubscribe.php?token=<64 hex>&action=resubscribe -> page with resubscribe action
 *   POST unsubscribe.php?token=<64 hex>  (form: action=unsubscribe|resubscribe)
 *   POST unsubscribe.php  (raw body: List-Unsubscribe=One-Click)  -> RFC 8058 one-click
 *
 * The 64-hex token is the credential: no sign-in required. State changes only
 * happen on POST.
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mail.php'; // for app_public_url()

send_cors_headers(); // harmless for browsers; not required for email clients

$pdo = db();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unsub_page(string $title, string $bodyHtml): void
{
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    header('Content-Type: text/html; charset=UTF-8');
    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{$safeTitle} · TheWairuaHeritage</title>
<style>
  body { margin: 0; padding: 0; background: #f4f1ec; font-family: Georgia, serif; }
  .wrap { max-width: 520px; margin: 40px auto; padding: 0 16px; }
  .card { background: #ffffff; border: 1px solid #e7e2da; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(21,42,30,.08); }
  .head { background: #152a1e; padding: 18px 24px; color: #fff; }
  .head .brand { font-size: 17px; font-weight: bold; letter-spacing: .04em; }
  .head .tag { color: #e08c2e; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; font-family: Arial, sans-serif; float: right; padding-top: 4px; }
  .body { padding: 24px 26px; color: #2f2b27; font-size: 15px; line-height: 1.6; }
  .body h1 { font-size: 21px; margin: 0 0 12px; color: #1f3628; }
  .btn { display: inline-block; background: #e08c2e; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 15px; font-weight: 700; padding: 12px 28px; border: none; border-radius: 24px; cursor: pointer; margin-top: 8px; }
  .btn-outline { background: transparent; color: #1f3628; border: 1px solid #c9c2b8; margin-left: 8px; }
  .muted { color: #8b837d; font-size: 13px; font-family: Arial, sans-serif; }
  .foot { border-top: 1px solid #eee7dc; padding: 14px 24px; font-size: 12px; color: #8b837d; font-family: Arial, sans-serif; }
  @media (max-width: 480px) {
    .wrap { margin: 16px auto; }
    .btn { display: block; width: 100%; box-sizing: border-box; text-align: center; margin: 8px 0 0; }
    .btn-outline { margin-left: 0; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="head"><span class="tag">Family Tree</span><span class="brand">TheWairuaHeritage</span></div>
      <div class="body">{$bodyHtml}</div>
      <div class="foot">TheWairuaHeritage &mdash; Our family, our legacy.</div>
    </div>
  </div>
</body>
</html>
HTML;
    exit;
}

function unsub_lookup_user(PDO $pdo, string $token): ?array
{
    if (!preg_match('/^[a-f0-9]{64}$/i', $token)) return null;
    $stmt = $pdo->prepare('SELECT id, email, display_name, email_notifications FROM users WHERE email_unsubscribe_token = ?');
    $stmt->execute([strtolower($token)]);
    $u = $stmt->fetch();
    return $u ?: null;
}

// ---------------------------------------------------------------------------
// RFC 8058 one-click (List-Unsubscribe-Post) — raw POST body, empty query token allowed
// ---------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input') ?: '';
    $isOneClick = stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/x-www-form-urlencoded') !== false
        && trim($raw) === 'List-Unsubscribe=One-Click';

    $token = $_GET['token'] ?? ($_POST['token'] ?? '');
    if ($isOneClick) {
        // One-click: credentials arrive only via the token in the query string.
        $token = $_GET['token'] ?? '';
        $u = unsub_lookup_user($pdo, (string)$token);
        if (!$u) {
            http_response_code(400);
            header('Content-Type: text/plain; charset=UTF-8');
            echo 'Invalid unsubscribe token';
            exit;
        }
        $pdo->prepare('UPDATE users SET email_notifications = 0 WHERE id = ?')->execute([$u['id']]);
        http_response_code(200);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Unsubscribed';
        exit;
    }

    // Regular HTML-form POST: change state and render a result page.
    $u = unsub_lookup_user($pdo, (string)$token);
    if (!$u) {
        unsub_page('Link invalid', '<h1>This unsubscribe link is invalid</h1><p class="muted">It may have expired or been copied incorrectly. Ask the site administrator to send you a fresh link.</p>');
    }
    $action = (string)($_POST['action'] ?? 'unsubscribe');
    if ($action === 'resubscribe') {
        $pdo->prepare('UPDATE users SET email_notifications = 1 WHERE id = ?')->execute([$u['id']]);
        unsub_page('Notifications on',
            '<h1>Welcome back, ' . htmlspecialchars((string)$u['display_name'], ENT_QUOTES, 'UTF-8') . '</h1>'
            . '<p>You will once again receive notification emails from TheWairuaHeritage (new messages, family events and reminders).</p>'
            . '<p><a class="btn" href="' . htmlspecialchars(app_public_url($pdo), ENT_QUOTES, 'UTF-8') . '">Open TheWairuaHeritage</a></p>');
    }
    $pdo->prepare('UPDATE users SET email_notifications = 0 WHERE id = ?')->execute([$u['id']]);
    unsub_page('Unsubscribed',
        '<h1>You have been unsubscribed</h1>'
        . '<p>' . htmlspecialchars((string)$u['email'], ENT_QUOTES, 'UTF-8') . ' will no longer receive notification emails from TheWairuaHeritage (new messages, family events and reminders).</p>'
        . '<p class="muted">You will still receive essential account emails such as password-reset and account-approval notices.</p>'
        . '<form method="post" action="?token=' . htmlspecialchars((string)($_GET['token'] ?? ''), ENT_QUOTES, 'UTF-8') . '">'
        . '<input type="hidden" name="action" value="resubscribe">'
        . '<button type="submit" class="btn btn-outline" style="margin-left:0;">Undo &mdash; resubscribe me</button>'
        . '</form>');
}

// ---------------------------------------------------------------------------
// GET: show the confirmation page (never changes state)
// ---------------------------------------------------------------------------
$token = (string)($_GET['token'] ?? '');
$u = unsub_lookup_user($pdo, $token);
if (!$u) {
    unsub_page('Link invalid', '<h1>This unsubscribe link is invalid</h1><p class="muted">It may have expired or been copied incorrectly. Ask the site administrator to send you a fresh link.</p>');
}
$alreadyOff = (int)$u['email_notifications'] === 0;
$home = htmlspecialchars(app_public_url($pdo), ENT_QUOTES, 'UTF-8');
$safeToken = htmlspecialchars($token, ENT_QUOTES, 'UTF-8');
$prefsForm = $alreadyOff
    ? '<form method="post" action="?token=' . $safeToken . '"><input type="hidden" name="action" value="resubscribe"><button type="submit" class="btn">Resubscribe to notifications</button></form>'
    : '<form method="post" action="?token=' . $safeToken . '"><input type="hidden" name="action" value="unsubscribe"><button type="submit" class="btn">Unsubscribe from notification emails</button></form>';
$status = $alreadyOff
    ? '<p>Notifications are currently <strong>off</strong> for <strong>' . htmlspecialchars((string)$u['email'], ENT_QUOTES, 'UTF-8') . '</strong>.</p>'
    : '<p>Click below to stop receiving notification emails at <strong>' . htmlspecialchars((string)$u['email'], ENT_QUOTES, 'UTF-8') . '</strong>.</p>';

unsub_page('Email notifications',
    '<h1>Email notifications</h1>'
    . $status
    . $prefsForm
    . '<p style="margin-top:16px;"><a class="muted" href="' . $home . '">&larr; Back to TheWairuaHeritage</a></p>');
