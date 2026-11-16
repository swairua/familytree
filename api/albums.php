<?php
/**
 * Photo albums for TheWairuaHeritage.
 *
 *   GET  albums.php?action=list
 *   GET  albums.php?action=view&id=N
 *   POST albums.php?action=create       { name, description? }
 *   POST albums.php?action=rename       { id, name, description? }
 *   POST albums.php?action=delete       { id }
 *   POST albums.php?action=add-photos   { id, photos: [filename, ...] }
 *   POST albums.php?action=remove-photo { id, photo }
 *   POST albums.php?action=set-cover    { id, photo }   ('' clears to auto)
 *
 * Photos are local files in data/photos/ (same whitelist as photo.php):
 * "<digits>.jpg" or "m<digits>.jpg". Any signed-in member may add/remove
 * photos; rename/delete/cover is limited to the album creator or an admin.
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

const PHOTO_PATTERN = '/^([0-9]{1,12}|m[0-9]{1,12})\.jpg$/i';

send_cors_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = db();

    if (session_status() === PHP_SESSION_NONE) {
        session_name('FAMILYTREE_SESSION');
        session_start();
    }
    $uid = $_SESSION['user_id'] ?? null;
    if (!$uid) send_error('You must be signed in', 401);
    $me = current_account($pdo, (int)$uid);
    if (!$me) send_error('Account not found', 401);

    $action = $_GET['action'] ?? 'list';
    switch ($action) {
        case 'list':
            handleList($pdo, $me);
            break;
        case 'view':
            handleView($pdo, $me);
            break;
        case 'create':
            handleCreate($pdo, $me);
            break;
        case 'rename':
            handleRename($pdo, $me);
            break;
        case 'delete':
            handleDelete($pdo, $me);
            break;
        case 'add-photos':
            handleAddPhotos($pdo, $me);
            break;
        case 'remove-photo':
            handleRemovePhoto($pdo, $me);
            break;
        case 'set-cover':
            handleSetCover($pdo, $me);
            break;
        default:
            send_error('Unknown action ' . $action, 404);
    }
} catch (Throwable $e) {
    send_error('Server error: ' . $e->getMessage(), 500);
}

// ---------------------------------------------------------------------------

function current_account(PDO $pdo, int $uid): ?array
{
    $s = $pdo->prepare('SELECT id, display_name, role FROM users WHERE id = ?');
    $s->execute([$uid]);
    $u = $s->fetch();
    return $u ?: null;
}

function photo_ok(string $photo): bool
{
    return (bool)preg_match(PHOTO_PATTERN, $photo);
}

/** Album row plus computed fields shared by list/view. */
function album_present(PDO $pdo, array $a, array $me): array
{
    $cover = (string)$a['cover_photo'];
    if ($cover === '' || !photo_ok($cover)) {
        $s = $pdo->prepare('SELECT photo FROM album_photos WHERE album_id = ? ORDER BY added_at ASC, photo ASC LIMIT 1');
        $s->execute([(int)$a['id']]);
        $cover = (string)($s->fetchColumn() ?: '');
    }
    return [
        'id' => (int)$a['id'],
        'name' => (string)$a['name'],
        'description' => (string)$a['description'],
        'cover_photo' => $cover,
        'photo_count' => (int)($a['photo_count'] ?? 0),
        'created_by' => $a['created_by'] !== null ? (int)$a['created_by'] : null,
        'created_name' => (string)($a['created_name'] ?? ''),
        'created_at' => (string)$a['created_at'],
        'can_manage' => ((int)$a['created_by'] === (int)$me['id']) || ($me['role'] ?? '') === 'admin',
    ];
}

function handleList(PDO $pdo, array $me): void
{
    $rows = $pdo->query(
        'SELECT a.*, u.display_name AS created_name, COUNT(ap.photo) AS photo_count
         FROM albums a
         LEFT JOIN users u ON u.id = a.created_by
         LEFT JOIN album_photos ap ON ap.album_id = a.id
         GROUP BY a.id
         ORDER BY a.created_at DESC, a.id DESC'
    )->fetchAll();
    send_json(['ok' => true, 'albums' => array_map(fn($a) => album_present($pdo, $a, $me), $rows)]);
}

function handleView(PDO $pdo, array $me): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) send_error('Missing album id', 400);
    $s = $pdo->prepare(
        'SELECT a.*, u.display_name AS created_name, COUNT(ap.photo) AS photo_count
         FROM albums a
         LEFT JOIN users u ON u.id = a.created_by
         LEFT JOIN album_photos ap ON ap.album_id = a.id
         WHERE a.id = ?
         GROUP BY a.id'
    );
    $s->execute([$id]);
    $a = $s->fetch();
    if (!$a) send_error('Album not found', 404);

    $p = $pdo->prepare('SELECT photo FROM album_photos WHERE album_id = ? ORDER BY added_at ASC, photo ASC');
    $p->execute([$id]);
    send_json([
        'ok' => true,
        'album' => album_present($pdo, $a, $me),
        'photos' => $p->fetchAll(PDO::FETCH_COLUMN),
    ]);
}

function handleCreate(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $name = trim((string)($body['name'] ?? ''));
    $description = trim((string)($body['description'] ?? ''));
    if ($name === '') send_error('Album name is required', 400);
    if (mb_strlen($name) > 120) send_error('Album name is too long (max 120 characters)', 400);
    if (mb_strlen($description) > 500) send_error('Description is too long (max 500 characters)', 400);

    $stmt = $pdo->prepare('INSERT INTO albums (name, description, created_by) VALUES (?, ?, ?)');
    $stmt->execute([$name, $description, $me['id']]);
    send_json(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
}

function fetch_album_or_404(PDO $pdo, int $id): array
{
    $s = $pdo->prepare('SELECT * FROM albums WHERE id = ?');
    $s->execute([$id]);
    $a = $s->fetch();
    if (!$a) send_error('Album not found', 404);
    return $a;
}

function manage_gate(PDO $pdo, array $me, int $albumId): array
{
    $a = fetch_album_or_404($pdo, $albumId);
    $canManage = ((int)$a['created_by'] === (int)$me['id']) || ($me['role'] ?? '') === 'admin';
    if (!$canManage) send_error('Only the album creator or an administrator can do that', 403);
    return $a;
}

function handleRename(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) send_error('Missing album id', 400);
    manage_gate($pdo, $me, $id);

    $name = trim((string)($body['name'] ?? ''));
    $description = trim((string)($body['description'] ?? ''));
    if ($name === '') send_error('Album name is required', 400);
    if (mb_strlen($name) > 120) send_error('Album name is too long (max 120 characters)', 400);
    if (mb_strlen($description) > 500) send_error('Description is too long (max 500 characters)', 400);

    $pdo->prepare('UPDATE albums SET name = ?, description = ? WHERE id = ?')->execute([$name, $description, $id]);
    send_json(['ok' => true]);
}

function handleDelete(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) send_error('Missing album id', 400);
    manage_gate($pdo, $me, $id);
    $pdo->prepare('DELETE FROM albums WHERE id = ?')->execute([$id]);
    send_json(['ok' => true]);
}

function handleAddPhotos(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) send_error('Missing album id', 400);
    $album = fetch_album_or_404($pdo, $id);

    $photos = $body['photos'] ?? [];
    if (!is_array($photos) || count($photos) === 0) send_error('No photos supplied', 400);
    if (count($photos) > 500) send_error('Too many photos in one request (max 500)', 400);

    $clean = [];
    foreach ($photos as $p) {
        $p = (string)$p;
        if (photo_ok($p)) $clean[$p] = true;
    }
    if (!$clean) send_error('No valid photo filenames supplied', 400);

    $ins = $pdo->prepare('INSERT IGNORE INTO album_photos (album_id, photo, added_by) VALUES (?, ?, ?)');
    $added = 0;
    foreach (array_keys($clean) as $photo) {
        $ins->execute([$id, $photo, $me['id']]);
        $added += $ins->rowCount();
    }
    // Auto-pick a cover if the album doesn't have one yet
    if (trim((string)($album['cover_photo'] ?? '')) === '' && $added > 0) {
        $first = $pdo->prepare('SELECT photo FROM album_photos WHERE album_id = ? ORDER BY added_at ASC, photo ASC LIMIT 1');
        $first->execute([$id]);
        $cover = (string)($first->fetchColumn() ?: '');
        if ($cover !== '') $pdo->prepare('UPDATE albums SET cover_photo = ? WHERE id = ?')->execute([$cover, $id]);
    }
    send_json(['ok' => true, 'added' => $added]);
}

function handleRemovePhoto(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    $photo = (string)($body['photo'] ?? '');
    if ($id <= 0 || !photo_ok($photo)) send_error('Missing album id or invalid photo', 400);
    fetch_album_or_404($pdo, $id); // must exist

    $pdo->prepare('DELETE FROM album_photos WHERE album_id = ? AND photo = ?')->execute([$id, $photo]);
    // If the cover was the removed photo, fall back to the first remaining one
    $s = $pdo->prepare('SELECT cover_photo FROM albums WHERE id = ?');
    $s->execute([$id]);
    if ((string)$s->fetchColumn() === $photo) {
        $first = $pdo->prepare('SELECT photo FROM album_photos WHERE album_id = ? ORDER BY added_at ASC, photo ASC LIMIT 1');
        $first->execute([$id]);
        $cover = (string)($first->fetchColumn() ?: '');
        $pdo->prepare('UPDATE albums SET cover_photo = ? WHERE id = ?')->execute([$cover, $id]);
    }
    send_json(['ok' => true]);
}

function handleSetCover(PDO $pdo, array $me): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Use POST', 405);
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    $photo = trim((string)($body['photo'] ?? ''));
    if ($id <= 0) send_error('Missing album id', 400);
    manage_gate($pdo, $me, $id);

    if ($photo !== '') {
        if (!photo_ok($photo)) send_error('Invalid photo filename', 400);
        $check = $pdo->prepare('SELECT COUNT(*) FROM album_photos WHERE album_id = ? AND photo = ?');
        $check->execute([$id, $photo]);
        if ((int)$check->fetchColumn() === 0) send_error('That photo is not in this album', 400);
    }
    $pdo->prepare('UPDATE albums SET cover_photo = ? WHERE id = ?')->execute([$photo, $id]);
    send_json(['ok' => true]);
}
