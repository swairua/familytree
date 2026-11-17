<?php
/**
 * Family member invitations — admin invites a member via a one-time link or email.
 *
 * Admin (session):
 *   GET  invites.php?action=search&query=...     -> list matching tree individuals
 *   POST invites.php?action=create               { individual_id, email?, name?, channel }
 *   POST invites.php?action=revoke              { id }
 *   POST invites.php?action=resend              { id }
 *   GET  invites.php?action=list                 -> outstanding invitations
 *
 * Public:
 *   GET  invites.php?action=verify&token=...     -> invitation preview (no auth)
 *   POST invites.php?action=accept               { token, email?, password }
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_lib.php';   // session gate + require_active_session_user
require_once __DIR__ . '/session_user.php';
require_once __DIR__ . '/mail.php';

send_cors_headers();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = db();

    $action = $_GET['action'] ?? 'list';

    switch ($action) {
        // Admin gated
        case 'search':
            $admin = adminUserOr403($pdo);
            handleSearch($pdo, $admin);
            break;
        case 'create':
            $admin = adminUserOr403($pdo);
            handleCreate($pdo, $admin);
            break;
        case 'revoke':
            $admin = adminUserOr403($pdo);
            handleRevoke($pdo, $admin);
            break;
        case 'resend':
            $admin = adminUserOr403($pdo);
            handleResend($pdo, $admin);
            break;
        case 'list':
            $admin = adminUserOr403($pdo);
            handleList($pdo, $admin);
            break;
        // Public
        case 'verify':
            handleVerify($pdo);
            break;
        case 'accept':
            handleAccept($pdo);
            break;
        default:
            send_error('Unknown action ' . $action, 404);
    }
} catch (Throwable $e) {
    send_error('Server error: ' . $e->getMessage(), 500);
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------

function adminUserOr403(PDO $pdo): array
{
    $me = require_active_session_user($pdo);
    if (($me['role'] ?? '') !== 'admin') {
        send_error('Administrator access required', 403);
    }
    return $me;
}

function handleSearch(PDO $pdo, array $admin): void
{
    $q = trim((string)($_GET['query'] ?? ''));
    if ($q === '' || mb_strlen($q) < 2) {
        send_json(['ok' => true, 'results' => []]);
    }
    $like = '%' . $q . '%';
    $stmt = $pdo->prepare(
        'SELECT i.id, i.name, i.given_name, i.surname, i.gender,
                i.photo, i.birth_date, i.death_date, i.email,
                (SELECT COUNT(*) FROM users u WHERE u.individual_id = i.id AND u.status <> \'rejected\') AS has_account
         FROM individuals i
         WHERE i.name LIKE ? OR i.given_name LIKE ? OR i.surname LIKE ?
         ORDER BY i.name ASC LIMIT 20'
    );
    $stmt->execute([$like, $like, $like]);
    send_json(['ok' => true, 'results' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

function handleCreate(PDO $pdo, array $admin): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $individualId = trim((string)($body['individual_id'] ?? ''));
    if ($individualId === '') send_error('Select a person to invite', 400);

    // Check individual exists
    $ind = $pdo->prepare('SELECT id, name, given_name, surname, email FROM individuals WHERE id = ?');
    $ind->execute([$individualId]);
    $i = $ind->fetch(PDO::FETCH_ASSOC);
    if (!$i) send_error('That person does not exist in the tree', 404);

    // Don't create if person already has an active account
    $existing = $pdo->prepare('SELECT id, email, status FROM users WHERE individual_id = ? AND status <> \'rejected\'');
    $existing->execute([$individualId]);
    if ($row = $existing->fetch()) {
        send_error('This person already has an account' . ($row['email'] ? ' (' . $row['email'] . ')' : ''), 409);
    }

    $invitedName = trim((string)$i['name']) ?: (trim((string)$i['given_name'] . ' ' . (string)$i['surname']));
    $invitedName = mb_substr($invitedName, 0, 255);

    $channel = ($body['channel'] ?? 'link') === 'email' ? 'email' : 'link';
    $email = mb_substr(trim((string)($body['email'] ?? '')), 0, 255);
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $expires = (new DateTime('+14 days'))->format('Y-m-d H:i:s');

    $ins = $pdo->prepare(
        'INSERT INTO member_invitations (individual_id, name, invited_by, email, token_hash, channel, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    try {
        $ins->execute([$individualId, $invitedName, (int)$admin['id'], $email, $tokenHash, $channel, $expires]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            send_error('That invitation already exists', 409);
        }
        throw $e;
    }
    $inviteId = (int)$pdo->lastInsertId();
    $url = app_public_url($pdo) . '/?view=enroll&token=' . $token;

    // Try to email them when we know an address
    $sent = false;
    if ($email !== '' && email_is_real($email)) {
        $html = '<p>Hi ' . htmlspecialchars($invitedName, ENT_QUOTES, 'UTF-8') . ',</p>'
            . '<p>You have been invited to join TheWairuaHeritage.</p>'
            . app_button('Accept your invitation', $url)
            . '<p style="font-size:13px;color:#8b837d">If the button does not work, visit <strong>' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '</strong></p>';
        $res = app_send_branded($pdo, $email, 'You\'re invited to TheWairuaHeritage',
            'Invitation to TheWairuaHeritage', 'You are invited', $html);
        $sent = !empty($res['ok']);
    }

    send_json([
        'ok' => true,
        'invite' => [
            'id' => $inviteId,
            'name' => $invitedName,
            'email' => $email,
            'channel' => $channel,
            'expires_at' => $expires,
        ],
        'link' => $url,
        'email_sent' => $sent,
    ]);
}

function handleRevoke(PDO $pdo, array $admin): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) send_error('Missing invitation id', 400);
    $upd = $pdo->prepare('DELETE FROM member_invitations WHERE id = ? AND used_at IS NULL');
    $upd->execute([$id]);
    send_json(['ok' => true, 'revoked' => $upd->rowCount() > 0]);
}

function handleResend(PDO $pdo, array $admin): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) send_error('Missing invitation id', 400);

    $s = $pdo->prepare('SELECT * FROM member_invitations WHERE id = ? AND used_at IS NULL');
    $s->execute([$id]);
    $inv = $s->fetch();
    if (!$inv) send_error('Invitation not found or already used', 404);

    $email = trim((string)$inv['email']);
    if ($email === '' || !email_is_real($email)) {
        send_error('This invitation has no email address — share the link instead', 400);
    }
    $url = app_public_url($pdo) . '/?view=enroll&token=';
    // Token is not stored raw; regenerate a new one for resend:
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $expires = (new DateTime('+14 days'))->format('Y-m-d H:i:s');
    $pdo->prepare('UPDATE member_invitations SET token_hash = ?, expires_at = ? WHERE id = ?')->execute([$tokenHash, $expires, $id]);

    // Re-fetch admin config public url for correct email link
    $url = app_public_url($pdo) . '/?view=enroll&token=' . $token;

    $html = '<p>Hi ' . htmlspecialchars((string)$inv['name'], ENT_QUOTES, 'UTF-8') . ',</p>'
        . '<p>You have been invited to join TheWairuaHeritage.</p>'
        . app_button('Accept your invitation', $url)
        . '<p style="font-size:13px;color:#8b837d">If the button does not work, visit <strong>' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '</strong></p>';
    $res = app_send_branded($pdo, $email, 'You\'re invited to TheWairuaHeritage',
        'Invitation to TheWairuaHeritage', 'You are invited', $html);
    send_json(['ok' => !empty($res['ok']), 'email_sent' => !empty($res['ok'])]);
}

function handleList(PDO $pdo, array $admin): void
{
    $rows = $pdo->query(
        'SELECT i.id, i.name, i.email, i.channel, i.invited_by, i.created_at, i.expires_at, i.used_at,
                inv.display_name AS invited_by_name,
                ii.name AS individual_name
         FROM member_invitations i
         LEFT JOIN users inv ON inv.id = i.invited_by
         LEFT JOIN individuals ii ON ii.id = i.individual_id
         ORDER BY i.created_at DESC LIMIT 200'
    )->fetchAll();
    send_json(['ok' => true, 'invitations' => $rows]);
}

// ---------------------------------------------------------------------------
// Public handlers
// ---------------------------------------------------------------------------

function handleVerify(PDO $pdo): void
{
    $token = (string)($_GET['token'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/i', $token)) send_error('Invalid token', 400);
    $tokenHash = hash('sha256', $token);

    $s = $pdo->prepare(
        'SELECT i.id, i.individual_id, i.name, i.email, i.channel, i.expires_at, i.used_at,
                ii.name AS individual_name, ii.photo AS individual_photo,
                ii.gender AS individual_gender, ii.birth_date AS individual_birth_date,
                (SELECT death_date FROM individuals WHERE id = i.individual_id) AS individual_death_date
         FROM member_invitations i
         LEFT JOIN individuals ii ON ii.id = i.individual_id
         WHERE i.token_hash = ?'
    );
    $s->execute([$tokenHash]);
    $inv = $s->fetch();
    if (!$inv) send_error('Invitation not found', 404);
    if ($inv['used_at']) send_error('This invitation has already been accepted', 410);
    if (strtotime((string)$inv['expires_at']) < time()) send_error('This invitation has expired', 410);

    // Find if user already exists for this individual
    $u = $pdo->prepare('SELECT id, status FROM users WHERE individual_id = ? AND status <> \'rejected\'');
    $u->execute([$inv['individual_id']]);
    $existing = $u->fetch();

    send_json([
        'ok' => true,
        'invitation' => [
            'id' => (int)$inv['id'],
            'name' => (string)$inv['name'],
            'email' => (string)$inv['email'],
            'channel' => (string)$inv['channel'],
            'expires_at' => (string)$inv['expires_at'],
            'individual_id' => (string)$inv['individual_id'],
            'individual_name' => (string)$inv['individual_name'],
            'individual_photo' => (string)$inv['individual_photo'],
            'individual_gender' => (string)$inv['individual_gender'],
            'individual_birth_date' => (string)$inv['individual_birth_date'],
            'individual_death_date' => (string)$inv['individual_death_date'],
            'account_exists' => $existing ? true : false,
            'account_status' => $existing['status'] ?? null,
        ],
    ]);
}

function handleAccept(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $token = (string)($body['token'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/i', $token)) send_error('Invalid token', 400);
    $tokenHash = hash('sha256', $token);

    $s = $pdo->prepare(
        'SELECT * FROM member_invitations WHERE token_hash = ? AND used_at IS NULL'
    );
    $s->execute([$tokenHash]);
    $inv = $s->fetch();
    if (!$inv) send_error('Invitation not found or already used', 404);
    if (strtotime((string)$inv['expires_at']) < time()) send_error('Invitation has expired', 410);

    $password = (string)($body['password'] ?? '');
    if (mb_strlen($password) < 8) send_error('Password must be at least 8 characters', 400);

    $email = trim((string)$inv['email']);
    if ($email === '') {
        $email = trim((string)($body['email'] ?? ''));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) send_error('A valid email is required', 400);
        if (str_ends_with(strtolower($email), '@placeholder.invalid')) send_error('Please provide a real email address', 400);
    }

    // Find existing user for this individual, or create one
    $u = $pdo->prepare('SELECT id FROM users WHERE individual_id = ? AND status <> \'rejected\'');
    $u->execute([$inv['individual_id']]);
    $existing = $u->fetch();

    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($existing) {
        $upd = $pdo->prepare('UPDATE users SET email = ?, display_name = ?, password_hash = ?, status = \'active\' WHERE id = ?');
        $upd->execute([$email, (string)$inv['name'], $hash, (int)$existing['id']]);
        $userId = (int)$existing['id'];
    } else {
        $ins = $pdo->prepare(
            'INSERT INTO users (email, password_hash, display_name, individual_id, role, status)
             VALUES (?, ?, ?, ?, \'member\', \'active\')'
        );
        try {
            $ins->execute([$email, $hash, (string)$inv['name'], (string)$inv['individual_id']]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') send_error('That email is already in use by another account', 409);
            throw $e;
        }
        $userId = (int)$pdo->lastInsertId();
    }

    // Mark invitation used
    $pdo->prepare('UPDATE member_invitations SET used_at = NOW() WHERE id = ?')->execute([(int)$inv['id']]);

    // Sign them in
    set_session_user($userId);

    send_json([
        'ok' => true,
        'message' => 'Account created. You are signed in.',
        'user' => current_user($pdo),
    ]);
}
