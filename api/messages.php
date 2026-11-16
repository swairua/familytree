<?php
/**
 * In-app messages between members.
 *
 *   GET  messages.php?action=inbox
 *   GET  messages.php?action=sent
 *   GET  messages.php?action=unread-count
 *   GET  messages.php?action=view&id=N
 *   POST messages.php?action=send         { to_user_id, subject, body }
 *   POST messages.php?action=mark-read    { id }
 *   POST messages.php?action=mark-all-read
 *   GET  messages.php?action=directory    (all authenticated users)
 *   GET  messages.php?action=search&q=... (all authenticated users)
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

    // Auth gate: any logged-in user can read their own messages
    if (session_status() === PHP_SESSION_NONE) {
        session_name('FAMILYTREE_SESSION');
        session_start();
    }
    $uid = $_SESSION['user_id'] ?? null;
    if (!$uid) send_error('You must be signed in', 401);
    $me = [
        'id' => (int)$uid,
    ];

    $action = $_GET['action'] ?? 'inbox';
    switch ($action) {
        case 'search':
            handleSearch($pdo, $me);
            break;
        case 'directory':
            handleDirectory($pdo);
            break;
        case 'inbox':
            handleInbox($pdo, $me);
            break;
        case 'sent':
            handleSent($pdo, $me);
            break;
        case 'unread-count':
            handleUnreadCount($pdo, $me);
            break;
        case 'view':
            handleView($pdo, $me);
            break;
        case 'send':
            handleSend($pdo, $me);
            break;
        case 'mark-read':
            handleMarkRead($pdo, $me);
            break;
        case 'mark-all-read':
            handleMarkAllRead($pdo, $me);
            break;
        default:
            send_error('Unknown action ' . $action, 404);
    }
} catch (Throwable $e) {
    send_error('Server error: ' . $e->getMessage(), 500);
}

// ---------------------------------------------------------------------------

function handleDirectory(PDO $pdo): void
{
    $stmt = $pdo->query(
        "SELECT id, display_name, role, status
         FROM users
         WHERE status IN ('active','pending')
         ORDER BY role = 'admin' DESC, display_name ASC"
    );
    send_json(['ok' => true, 'users' => $stmt->fetchAll()]);
}

function handleSearch(PDO $pdo, array $me): void
{
    $q = trim((string)($_GET['q'] ?? ''));
    if (mb_strlen($q) < 2) {
        send_json(['ok' => true, 'messages' => []]);
    }
    $like = '%' . $q . '%';
    $stmt = $pdo->prepare(
        'SELECT m.id, m.from_user_id, m.to_user_id, m.subject, m.body, m.is_read, m.created_at,'
        . ' CASE WHEN m.to_user_id = ? THEN u_from.display_name ELSE u_to.display_name END AS other_name,'
        . ' m.to_user_id AS target_id, m.from_user_id AS source_id'
        . ' FROM messages m'
        . ' JOIN users u_from ON u_from.id = m.from_user_id'
        . ' JOIN users u_to ON u_to.id = m.to_user_id'
        . ' WHERE (m.subject LIKE ? OR m.body LIKE ?) AND (m.to_user_id = ? OR m.from_user_id = ?)'
        . ' ORDER BY m.created_at DESC LIMIT 100'
    );
    $stmt->execute([$me['id'], $like, $like, $me['id'], $me['id']]);
    send_json(['ok' => true, 'messages' => $stmt->fetchAll()]);
}

function user_row(PDO $pdo, int $uid): ?array
{
    $s = $pdo->prepare('SELECT id, display_name, role, email FROM users WHERE id = ?');
    $s->execute([$uid]);
    $u = $s->fetch(PDO::FETCH_ASSOC);
    return $u ?: null;
}

function handleInbox(PDO $pdo, array $me): void
{
    $stmt = $pdo->prepare(
        'SELECT m.id, m.from_user_id, m.to_user_id, m.subject, m.body, m.is_read, m.created_at, u.display_name AS from_name
'
        . ' FROM messages m JOIN users u ON u.id = m.from_user_id
'
        . ' WHERE m.to_user_id = ? ORDER BY m.created_at DESC LIMIT 200'
    );
    $stmt->execute([$me['id']]);
    send_json(['ok' => true, 'messages' => $stmt->fetchAll()]);
}

function handleSent(PDO $pdo, array $me): void
{
    $stmt = $pdo->prepare(
        'SELECT m.id, m.from_user_id, m.to_user_id, m.subject, m.body, m.is_read, m.created_at, u.display_name AS to_name
'
        . ' FROM messages m JOIN users u ON u.id = m.to_user_id
'
        . ' WHERE m.from_user_id = ? ORDER BY m.created_at DESC LIMIT 200'
    );
    $stmt->execute([$me['id']]);
    send_json(['ok' => true, 'messages' => $stmt->fetchAll()]);
}

function handleUnreadCount(PDO $pdo, array $me): void
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM messages WHERE to_user_id = ? AND is_read = 0');
    $stmt->execute([$me['id']]);
    send_json(['ok' => true, 'count' => (int)$stmt->fetchColumn()]);
}

function handleView(PDO $pdo, array $me): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) send_error('Missing id', 400);
    $stmt = $pdo->prepare('SELECT * FROM messages WHERE id = ?');
    $stmt->execute([$id]);
    $m = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$m) send_error('Message not found', 404);
    if ((int)$m['to_user_id'] !== $me['id'] && (int)$m['from_user_id'] !== $me['id']) {
        send_error('Access denied', 403);
    }
    $from = user_row($pdo, (int)$m['from_user_id']);
    $to = user_row($pdo, (int)$m['to_user_id']);
    $m['from_name'] = $from['display_name'] ?? 'Unknown';
    $m['to_name'] = $to['display_name'] ?? 'Unknown';

    // Mark as read if recipient
    if ((int)$m['to_user_id'] === $me['id'] && (int)$m['is_read'] === 0) {
        $upd = $pdo->prepare('UPDATE messages SET is_read = 1 WHERE id = ?');
        $upd->execute([$id]);
        $m['is_read'] = 1;
    }
    send_json(['ok' => true, 'message' => $m]);
}

function handleSend(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $toId = (int)($body['to_user_id'] ?? 0);
    $subject = trim((string)($body['subject'] ?? ''));
    $text = trim((string)($body['body'] ?? ''));
    if ($toId <= 0) send_error('Recipient is required', 400);
    if ($text === '') send_error('Message body is required', 400);
    if (mb_strlen($text) > 5000) send_error('Message too long', 400);
    if ($toId === $me['id']) send_error('You cannot message yourself', 400);
    // ensure recipient exists and is not rejected
    $recipient = user_row($pdo, $toId);
    if (!$recipient) send_error('Recipient not found', 404);
    if ($recipient['role'] === 'rejected') send_error('Cannot message this account', 400);

    $stmt = $pdo->prepare('INSERT INTO messages (from_user_id, to_user_id, subject, body) VALUES (?, ?, ?, ?)');
    $stmt->execute([$me['id'], $toId, mb_substr($subject, 0, 255), $text]);
    $msgId = (int)$pdo->lastInsertId();

    // Best-effort: email the recipient if their address is real (not placeholder).
    require_once __DIR__ . '/mail.php';
    $from = user_row($pdo, $me['id']);
    $fromName = $from['display_name'] ?? 'TheWairuaHeritage';
    $recipientEmail = trim((string)($recipient['email'] ?? ''));
    if (email_is_real($recipientEmail)) {
        $link = app_public_url($pdo) . '/?view=messages&thread=' . $msgId;
        $recipientName = trim((string)($recipient['display_name'] ?? ''));
        $greet = $recipientName !== '' ? 'Hi ' . htmlspecialchars($recipientName, ENT_QUOTES, 'UTF-8') . ',' : 'Hello,';
        app_send_branded($pdo, $recipientEmail,
            'New message from ' . $fromName . ': ' . ($subject !== '' ? $subject : '(no subject)'),
            'New message from ' . $fromName,
            'New message',
            '<p>' . $greet . '</p><p>' . htmlspecialchars($fromName, ENT_QUOTES, 'UTF-8') . ' sent you a message on TheWairuaHeritage:</p>'
            . '<blockquote style="margin:14px 0;padding:12px 14px;background:#faf8f5;border-left:4px solid #e08c2e;color:#3a332d;font-style:italic;">'
            . nl2br(htmlspecialchars($text, ENT_QUOTES, 'UTF-8')) . '</blockquote>'
            . app_button('Read and reply', $link),
            null,
            'notification'
        );
    }

    send_json(['ok' => true, 'id' => $msgId]);
}

function handleMarkRead(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) send_error('Missing id', 400);
    $upd = $pdo->prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND to_user_id = ?');
    $upd->execute([$id, $me['id']]);
    if ($upd->rowCount() === 0) send_error('Message not found', 404);
    send_json(['ok' => true]);
}

function handleMarkAllRead(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $pdo->prepare('UPDATE messages SET is_read = 1 WHERE to_user_id = ? AND is_read = 0')->execute([$me['id']]);
    send_json(['ok' => true]);
}
