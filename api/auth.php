<?php
/**
 * Authentication endpoint: login / logout / me / register / change-password /
 * change-profile / admin user management (list, approve, reject, delete).
 *
 * Web:
 *   POST auth.php?action=login           { email, password }
 *   POST auth.php?action=logout          (empty)
 *   GET  auth.php?action=me
 *   POST auth.php?action=register        { name, email, password }   (public, creates pending member)
 *   POST auth.php?action=change-password { current_password, new_password }  (session)
 *   POST auth.php?action=change-profile  { display_name, email }             (session)
 *   POST auth.php?action=forgot-password { email }                           (public)
 *   POST auth.php?action=reset-password  { token, password }                 (public)
 *   GET  auth.php?action=users-list                                          (admin)
 *   POST auth.php?action=user-approve    { id }                              (admin)
 *   POST auth.php?action=user-reject     { id }                              (admin)
 *   POST auth.php?action=user-set-password { id, password }                  (admin)
 *   POST auth.php?action=user-set-email    { id, email }                     (admin)
 *   POST auth.php?action=user-delete     { id }                              (admin)
 *
 * CLI:
 *   php auth.php seed-user <email> <password> [individual_id] [role]
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mail.php';

$action = $_GET['action'] ?? (php_sapi_name() === 'cli' ? ($argv[1] ?? 'help') : 'me');
$isCli  = php_sapi_name() === 'cli';

if (!$isCli) {
    send_cors_headers();
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

function start_session_cookie(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name('FAMILYTREE_SESSION');
        session_start();
    }
}

function current_user(PDO $pdo): ?array
{
    start_session_cookie();
    $uid = $_SESSION['user_id'] ?? null;
    if (!$uid) return null;
    $stmt = $pdo->prepare('SELECT id, email, display_name, individual_id, role, status FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $u = $stmt->fetch();
    return $u ?: null;
}

function session_user_or_401(PDO $pdo): array
{
    $u = current_user($pdo);
    if (!$u) send_error('You must be signed in', 401);
    return $u;
}

function admin_user_or_403(PDO $pdo): array
{
    $u = session_user_or_401($pdo);
    if (($u['role'] ?? '') !== 'admin') send_error('Administrator access required', 403);
    return $u;
}

function set_session_user(int $userId): void
{
    start_session_cookie();
    $_SESSION['user_id'] = $userId;
}

function clear_session_user(): void
{
    start_session_cookie();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

// Best-effort member notification: silently skip when the recipient has a
// placeholder or invalid address (e.g. imported members without real email).
function notify_user(PDO $pdo, int $userId, string $subject, string $preheader, string $title, string $bodyHtml): void
{
    try {
        $stmt = $pdo->prepare('SELECT email, display_name FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $u = $stmt->fetch();
        if (!$u || !email_is_real((string)$u['email'])) return;
        app_send_branded($pdo, (string)$u['email'], $subject, $preheader, $title, $bodyHtml);
    } catch (Throwable $e) {
        // Never break the caller's request on email failure
    }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

if ($isCli) {
    require_once __DIR__ . '/config.php';
    $pdo = db();

    if ($action === 'seed-user') {
        $email = $argv[2] ?? null;
        $pass  = $argv[3] ?? null;
        $individual = $argv[4] ?? null;
        $role  = $argv[5] ?? 'admin';

        if (!$email || !$pass) {
            fwrite(STDERR, "Usage: php auth.php seed-user <email> <password> [individual_id] [role]\n");
            exit(1);
        }

        $hash = password_hash($pass, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, individual_id, role) VALUES (?, ?, ?, ?, ?)');
        try {
            $stmt->execute([$email, $hash, 'Simon Gichuki', $individual, $role]);
            echo "Created user {$email} (id " . $pdo->lastInsertId() . ")\n";
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                $upd = $pdo->prepare('UPDATE users SET password_hash = ?, display_name = ?, individual_id = ?, role = ? WHERE email = ?');
                $upd->execute([$hash, 'Simon Gichuki', $individual, $role, $email]);
                echo "Updated user {$email}\n";
            } else {
                throw $e;
            }
        }
        exit(0);
    }

    fwrite(STDERR, "Unknown CLI action: {$action}\n");
    exit(1);
}

$pdo = db();

switch ($action) {
    case 'login':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            send_error('Use POST', 405);
        }
        $body = read_json_body();
        $email = trim((string)($body['email'] ?? ''));
        $pass  = (string)($body['password'] ?? '');
        if ($email === '' || $pass === '') {
            send_error('Email and password are required', 400);
        }
        $stmt = $pdo->prepare('SELECT id, password_hash, status FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $u = $stmt->fetch();
        if (!$u || !password_verify($pass, $u['password_hash'])) {
            send_error('Invalid email or password', 401);
        }
        if (($u['status'] ?? 'active') !== 'active') {
            if ($u['status'] === 'pending') {
                send_error('Your account is pending approval by the site administrator', 403);
            }
            send_error('Your account has been disabled. Please contact the site administrator.', 403);
        }
        set_session_user((int)$u['id']);
        send_json(['ok' => true, 'user' => current_user($pdo)]);
        break;

    case 'register':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            send_error('Use POST', 405);
        }
        $body = read_json_body();
        $name = trim((string)($body['name'] ?? ''));
        $email = trim((string)($body['email'] ?? ''));
        $pass = (string)($body['password'] ?? '');
        if ($name === '' || $email === '' || $pass === '') {
            send_error('Name, email and password are required', 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            send_error('Please enter a valid email address', 400);
        }
        if (mb_strlen($pass) < 8) {
            send_error('Password must be at least 8 characters', 400);
        }
        $hash = password_hash($pass, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, role, status) VALUES (?, ?, ?, ?, ?)');
        try {
            $stmt->execute([$email, $hash, mb_substr($name, 0, 255), 'member', 'pending']);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                send_error('That email is already registered', 409);
            }
            throw $e;
        }
        // Welcome + notify admins (best effort — don't fail the request)
        app_send_branded($pdo, $email,
            'Welcome to TheWairuaHeritage — your account is pending',
            'Welcome to the family',
            'Account received',
            '<p>Hi ' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . ',</p>'
            . '<p>Thanks for requesting a TheWairuaHeritage account. We received your registration and it is <strong>pending administrator approval</strong>.</p>'
            . '<p>You will receive another email as soon as it is approved, and you\'ll be able to sign in at <a href="' . htmlspecialchars(app_public_url($pdo), ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars(app_public_url($pdo), ENT_QUOTES, 'UTF-8') . '</a>.</p>'
        );
        // Notify all admins
        try {
            $admins = $pdo->query("SELECT email FROM users WHERE role = 'admin' AND status = 'active'")->fetchAll(PDO::FETCH_COLUMN);
        } catch (Throwable $e) {
            $admins = [];
        }
        foreach ($admins as $adminEmail) {
            app_send_branded($pdo, (string)$adminEmail,
                'New member request · ' . $name,
                'New member request from ' . $name,
                'New member request',
                '<p><strong>' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '</strong> has requested a TheWairuaHeritage account.</p>'
                . '<p>Email: ' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . '</p>'
                . '<p>Approve them from the Site members page:</p>'
                . app_button('Review members', app_public_url($pdo) . '/?view=members')
            );
        }
        send_json(['ok' => true, 'message' => 'Registration received. Your account is pending approval by the site administrator.']);
        break;

    case 'change-password':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            send_error('Use POST', 405);
        }
        $me = session_user_or_401($pdo);
        $body = read_json_body();
        $current = (string)($body['current_password'] ?? '');
        $new = (string)($body['new_password'] ?? '');
        if ($current === '' || $new === '') {
            send_error('Current and new password are required', 400);
        }
        if (mb_strlen($new) < 8) {
            send_error('New password must be at least 8 characters', 400);
        }
        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([$me['id']]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($current, $row['password_hash'])) {
            send_error('Current password is incorrect', 401);
        }
        $upd = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $upd->execute([password_hash($new, PASSWORD_DEFAULT), $me['id']]);
        app_send_branded($pdo, (string)$me['email'],
            'Your password was changed',
            'Your password was changed',
            'Password updated',
            '<p>Hi ' . htmlspecialchars($me['display_name'], ENT_QUOTES, 'UTF-8') . ',</p>'
            . '<p>This is a confirmation that the password for your TheWairuaHeritage account was changed at <strong>' . date('Y-m-d H:i:s') . '</strong>.</p>'
            . '<p>If you did not make this change, reply to the site administrator immediately.</p>'
        );
        send_json(['ok' => true]);
        break;

    case 'change-profile':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            send_error('Use POST', 405);
        }
        $me = session_user_or_401($pdo);
        $body = read_json_body();
        $name = trim((string)($body['display_name'] ?? ''));
        $email = trim((string)($body['email'] ?? ''));
        if ($name === '') send_error('Display name is required', 400);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            send_error('Please enter a valid email address', 400);
        }
        $dup = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = ? AND id <> ?');
        $dup->execute([$email, $me['id']]);
        if ((int)$dup->fetchColumn() > 0) {
            send_error('That email is already used by another account', 409);
        }
        $upd = $pdo->prepare('UPDATE users SET display_name = ?, email = ? WHERE id = ?');
        $upd->execute([mb_substr($name, 0, 255), mb_substr($email, 0, 255), $me['id']]);
        send_json(['ok' => true, 'user' => current_user($pdo)]);
        break;

    case 'forgot-password':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            send_error('Use POST', 405);
        }
        $body = read_json_body();
        $email = trim((string)($body['email'] ?? ''));
        if ($email === '') send_error('Email is required', 400);
        // Generic response: never reveal whether an account exists
        $generic = 'If an account exists for this email, a reset link has been sent.';
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $stmt = $pdo->prepare('SELECT id, display_name FROM users WHERE email = ? AND status = \'active\'');
            $stmt->execute([$email]);
            $u = $stmt->fetch();
            if ($u && email_is_real($email)) {
                $token = bin2hex(random_bytes(32));
                $tokenHash = hash('sha256', $token);
                $exp = (new DateTime('+1 hour'))->format('Y-m-d H:i:s');
                $pdo->prepare('DELETE FROM password_resets WHERE user_id = ? AND used = 0')->execute([$u['id']]);
                $ins = $pdo->prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)');
                $ins->execute([$u['id'], $tokenHash, $exp]);
                $link = app_public_url($pdo) . '/?view=reset-password&token=' . $token;
                app_send_branded($pdo, $email,
                    'Reset your TheWairuaHeritage password',
                    'Reset your password',
                    'Reset your TheWairuaHeritage password',
                    '<p>Hi ' . htmlspecialchars($u['display_name'], ENT_QUOTES, 'UTF-8') . ',</p>'
                    . '<p>We received a request to reset the password for your account. Click the button below — it is valid for <strong>1 hour</strong> and can be used once.</p>'
                    . app_button('Reset my password', $link)
                    . '<p style="font-size:13px;color:#8b837d;">If you didn\'t request this, you can ignore this email.</p>'
                );
            }
        }
        send_json(['ok' => true, 'message' => $generic]);
        break;

    case 'reset-password':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            send_error('Use POST', 405);
        }
        $body = read_json_body();
        $token = (string)($body['token'] ?? '');
        $password = (string)($body['password'] ?? '');
        if ($token === '' || $password === '') {
            send_error('Token and password are required', 400);
        }
        if (mb_strlen($password) < 8) {
            send_error('Password must be at least 8 characters', 400);
        }
        if (!preg_match('/^[a-f0-9]{64}$/i', $token)) {
            send_error('This reset link is invalid or has expired', 400);
        }
        $tokenHash = hash('sha256', $token);
        $stmt = $pdo->prepare('SELECT id, user_id, expires_at FROM password_resets WHERE token_hash = ? AND used = 0');
        $stmt->execute([$tokenHash]);
        $reset = $stmt->fetch();
        // Compare against PHP's clock so timezone differences between PHP and DB don't reject valid tokens
        if (!$reset || strtotime((string)$reset['expires_at']) < time()) {
            send_error('This reset link is invalid or has expired', 400);
        }
        $newHash = password_hash($password, PASSWORD_DEFAULT);
        $upd = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $upd->execute([$newHash, $reset['user_id']]);
        $mark = $pdo->prepare('UPDATE password_resets SET used = 1 WHERE id = ?');
        $mark->execute([$reset['id']]);
        $stmt2 = $pdo->prepare('SELECT email, display_name FROM users WHERE id = ?');
        $stmt2->execute([$reset['user_id']]);
        $u = $stmt2->fetch();
        if ($u) {
            app_send_branded($pdo, (string)$u['email'],
                'Your password was changed',
                'Your password was changed',
                'Password updated',
                '<p>Hi ' . htmlspecialchars($u['display_name'], ENT_QUOTES, 'UTF-8') . ',</p>'
                . '<p>This confirms your TheWairuaHeritage password was reset at <strong>' . date('Y-m-d H:i:s') . '</strong>.</p>'
                . app_button('Sign in to TheWairuaHeritage', app_public_url($pdo))
            );
        }
        send_json(['ok' => true]);
        break;

    case 'users-list':
        admin_user_or_403($pdo);
        $stmt = $pdo->query(
            'SELECT u.id, u.email, u.display_name, u.role, u.status, u.individual_id, u.photo, i.name AS individual_name, i.photo AS individual_photo, i.gender AS individual_gender
'
            . ' FROM users u LEFT JOIN individuals i ON i.id = u.individual_id
'
            . ' ORDER BY FIELD(u.status, \'pending\', \'active\', \'rejected\'), u.created_at DESC'
        );
        $list = $stmt->fetchAll();
        send_json(['ok' => true, 'users' => $list]);
        break;

    case 'user-set-email':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            send_error('Use POST', 405);
        }
        admin_user_or_403($pdo);
        $body = read_json_body();
        $id = (int)($body['id'] ?? 0);
        $email = trim((string)($body['email'] ?? ''));
        if ($id <= 0) send_error('Missing user id', 400);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            send_error('Please enter a valid email address', 400);
        }
        $dup = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = ? AND id <> ?');
        $dup->execute([$email, $id]);
        if ((int)$dup->fetchColumn() > 0) {
            send_error('That email is already used by another account', 409);
        }
        $upd = $pdo->prepare('UPDATE users SET email = ? WHERE id = ?');
        $upd->execute([mb_substr($email, 0, 255), $id]);
        if ($upd->rowCount() === 0) send_error('User not found', 404);
        // Welcome the member at their new, real address
        notify_user($pdo, $id,
            'Welcome to TheWairuaHeritage',
            'Welcome to TheWairuaHeritage',
            'Welcome to the family',
            '<p>Hi,</p>'
            . '<p>The administrator has added your email to TheWairuaHeritage and you\'ll need it to sign in.</p>'
            . '<p>Sign in with this address — if this is your first visit, use <strong>Forgot password</strong> to choose one.</p>'
            . app_button('Sign in to TheWairuaHeritage', app_public_url($pdo) . '/')
        );
        send_json(['ok' => true]);
        break;

    case 'user-set-password':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            send_error('Use POST', 405);
        }
        admin_user_or_403($pdo);
        $body = read_json_body();
        $id = (int)($body['id'] ?? 0);
        $newPassword = (string)($body['password'] ?? '');
        if ($id <= 0) send_error('Missing user id', 400);
        if (mb_strlen($newPassword) < 8) send_error('Password must be at least 8 characters', 400);
        $hash = password_hash($newPassword, PASSWORD_DEFAULT);
        $upd = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $upd->execute([$hash, $id]);
        if ($upd->rowCount() === 0) send_error('User not found', 404);
        // Notify the member their password was changed by an administrator
        notify_user($pdo, $id,
            'Your password was changed',
            'Your password was changed',
            'Password updated',
            '<p>Hi,</p><p>An administrator updated the password for your TheWairuaHeritage account.</p>'
            . '<p>If you have any questions, contact the site administrator.</p>'
        );
        send_json(['ok' => true]);
        break;

    case 'user-approve':
    case 'user-reject':
    case 'user-delete':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            send_error('Use POST', 405);
        }
        $admin = admin_user_or_403($pdo);
        $body = read_json_body();
        $id = (int)($body['id'] ?? 0);
        if ($id <= 0) send_error('Missing user id', 400);
        if ($action === 'user-delete') {
            if ($id === (int)$admin['id']) send_error('You cannot delete your own account', 400);
            if ($id === 1) send_error('The primary administrator account cannot be deleted', 400);
            $del = $pdo->prepare('DELETE FROM users WHERE id = ?');
            $del->execute([$id]);
            if ($del->rowCount() === 0) send_error('User not found', 404);
            send_json(['ok' => true]);
            break;
        }
        $newStatus = $action === 'user-approve' ? 'active' : 'rejected';
        $upd = $pdo->prepare('UPDATE users SET status = ? WHERE id = ?');
        $upd->execute([$newStatus, $id]);
        if ($upd->rowCount() === 0) send_error('User not found', 404);
        if ($newStatus === 'active') {
            notify_user($pdo, $id,
                'Your TheWairuaHeritage account was approved',
                'Your account was approved',
                'Welcome — your account is approved',
                '<p>Hi,</p>'
                . '<p>Great news — your TheWairuaHeritage account has been approved. You can now sign in.</p>'
                . app_button('Sign in to TheWairuaHeritage', app_public_url($pdo) . '/')
                . '<p style="font-size:13px;color:#8b837d;">First time signing in? Use <strong>Forgot password</strong> on the sign-in page to choose one.</p>'
            );
        } else {
            notify_user($pdo, $id,
                'Your TheWairuaHeritage account request was declined',
                'Your account request was declined',
                'Account request declined',
                '<p>Hi,</p><p>Your request for a TheWairuaHeritage account was not approved at this time.</p>'
                . '<p>If you have questions, contact the site administrator.</p>'
            );
        }
        send_json(['ok' => true]);
        break;

    case 'logout':
        clear_session_user();
        send_json(['ok' => true]);
        break;

    case 'me':
        $u = current_user($pdo);
        send_json(['ok' => true, 'authenticated' => (bool)$u, 'user' => $u]);
        break;

    default:
        send_error('Unknown auth action', 404);
}
