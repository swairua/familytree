<?php
/**
 * Shared session gate for web endpoints.
 *
 * Every endpoint that requires a signed-in member should call
 * require_active_session_user() instead of reading $_SESSION manually. It
 * enforces, in one place:
 *   - session exists and belongs to a real user
 *   - account status is 'active' (pending/disabled/deleted are rejected)
 *   - the session's session_version matches the user's current version
 *     (bumping the version — on password change or "sign out everywhere" —
 *     revokes all outstanding sessions)
 *
 * send_error() is used for failures, so callers never handle the unhappy path.
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function require_active_session_user(PDO $pdo): array
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name('FAMILYTREE_SESSION');
        session_start();
    }
    $uid = $_SESSION['user_id'] ?? null;
    if (!$uid) {
        send_error('You must be signed in', 401);
    }
    $stmt = $pdo->prepare('SELECT id, email, display_name, role, status, session_version FROM users WHERE id = ?');
    $stmt->execute([(int)$uid]);
    $u = $stmt->fetch();
    if (!$u) {
        auth_lib_destroy_session();
        send_error('Your account no longer exists. Please sign in again.', 401);
    }
    if (($u['status'] ?? 'active') !== 'active') {
        auth_lib_destroy_session();
        send_error('Your account is disabled. Please contact the site administrator.', 403);
    }
    if ((int)($_SESSION['session_version'] ?? 0) !== (int)$u['session_version']) {
        auth_lib_destroy_session();
        send_error('You were signed out on this device because your account signed out elsewhere. Please sign in again.', 401);
    }
    $u['id'] = (int)$u['id'];
    return $u;
}

function auth_lib_destroy_session(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name('FAMILYTREE_SESSION');
        session_start();
    }
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}
