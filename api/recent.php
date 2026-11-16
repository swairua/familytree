<?php
/**
 * Serves locally-synced recent activity feed (data/recent_activity.json).
 *
 *   GET recent.php        -> { ok: true, syncedAt, source, entries }
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if (!is_cli()) {
    send_cors_headers();
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$file = __DIR__ . '/../data/recent_activity.json';
if (!is_file($file)) {
    send_json(['ok' => false, 'error' => 'Recent activity not synced yet.'], 404);
}

$data = json_decode(file_get_contents($file), true);
if (!is_array($data)) {
    send_error('Corrupt recent activity file', 500);
}

send_json(array_merge(['ok' => true], $data));

