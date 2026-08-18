<?php
/**
 * Serves locally-downloaded MyHeritage profile photos from data/photos/.
 *
 *   GET photo.php?file=2000001.jpg
 *   GET photo.php?id=I2000001        (numeric gid only, strips optional I prefix)
 *
 * With caching headers so the browser doesn't refetch on every render.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

if (!is_cli()) {
    send_cors_headers();
}

function photo_dir(): string
{
    return __DIR__ . '/../data/photos';
}

$name = '';
if (!empty($_GET['file'])) {
    $name = trim((string) $_GET['file']);
} elseif (!empty($_GET['id'])) {
    $id = trim((string) $_GET['id']);
    // Accept "I2000001" or "2000001"
    if (preg_match('/^I?(\d+)$/', $id, $m)) $name = $m[1] . '.jpg';
}

// Strict whitelist: only digit-based jpg filenames (prevents path traversal).
if (!preg_match('/^[0-9]+\.jpg$/', $name)) {
    send_error('Bad file', 400);
}

$path = photo_dir() . '/' . $name;
if (!is_file($path)) {
    // 404 with a tiny transparent pixel fallback is friendlier for <img> tags,
    // but a plain 404 is fine too since the UI hides broken images.
    send_error('Not found', 404);
}

$etag = '"' . md5_file($path) . '"';

header('Content-Type: image/jpeg');
header('Content-Length: ' . (string) filesize($path));
header('Cache-Control: public, max-age=604800, immutable');
header('ETag: ' . $etag);

if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    http_response_code(304);
    exit;
}

readfile($path);
exit;