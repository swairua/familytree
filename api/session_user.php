<?php
/**
 * Shared session helpers for TheWairuaHeritage API endpoints.
 *
 * Moved here from auth.php so OAuth callbacks (invites.php, familysearch.php, ...) can
 * set/clear the PHP session without loading auth.php's route dispatcher.
 *
 *   require_once __DIR__ . '/session_user.php';
 */
declare(strict_types=1);

function start_session_cookie(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name('FAMILYTREE_SESSION');
        session_start();
    }
}

function session_user_row(PDO $pdo, int $uid): ?array
{
    $stmt = $pdo->prepare('SELECT id, email, display_name, individual_id, role, status, session_version, totp_enabled, totp_secret, dna_tested FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $u = $stmt->fetch();
    return $u ?: null;
}

function current_user(PDO $pdo): ?array
{
    start_session_cookie();
    $uid = $_SESSION['user_id'] ?? null;
    if (!$uid) return null;
    $u = session_user_row($pdo, (int)$uid);
    if (!$u) {
        clear_session_user();
        return null;
    }
    if ((int)($_SESSION['session_version'] ?? 0) !== (int)$u['session_version']) {
        clear_session_user();
        return null;
    }
    if (($u['status'] ?? 'active') !== 'active') {
        clear_session_user();
        return null;
    }
    unset($u['session_version'], $u['totp_secret']);
    return $u;
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
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    try {
        $u = session_user_row(db(), $userId);
        $_SESSION['session_version'] = (int)($u['session_version'] ?? 0);
    } catch (Throwable $e) {
        $_SESSION['session_version'] = 0;
    }
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
