<?php
/**
 * Authentication endpoint: login / logout / me / seed-user (CLI only).
 *
 * Web:
 *   POST auth.php?action=login     { email, password }
 *   POST auth.php?action=logout    (empty)
 *   GET  auth.php?action=me
 *
 * CLI:
 *   php auth.php seed-user <email> <password> [individual_id] [role]
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

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
    $stmt = $pdo->prepare('SELECT id, email, display_name, individual_id, role FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $u = $stmt->fetch();
    return $u ?: null;
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
        $stmt = $pdo->prepare('SELECT id, password_hash FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $u = $stmt->fetch();
        if (!$u || !password_verify($pass, $u['password_hash'])) {
            send_error('Invalid email or password', 401);
        }
        set_session_user((int)$u['id']);
        send_json(['ok' => true, 'user' => current_user($pdo)]);
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
