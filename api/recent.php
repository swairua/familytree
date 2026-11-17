<?php
/**
 * Serves locally-synced recent activity feed (data/recent_activity.json).
 *
 *   GET recent.php        -> { ok: true, syncedAt, source, entries }
 */
declare(strict_types=1);

// recent.php doesn't need the database - just read the JSON file
$file = __DIR__ . '/../data/recent_activity.json';
if (!is_file($file)) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Recent activity not synced yet.']);
    exit;
}

$data = json_decode(file_get_contents($file), true);
if (!is_array($data)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Corrupt recent activity file']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(array_merge(['ok' => true], $data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
exit;


