<?php
/**
 * Sync endpoint: re-pull data from MyHeritage via the CDP browser and update
 * the database progressively.
 *
 *   GET  sync.php?action=status   → current progress from data/sync_status.json
 *   POST sync.php?action=start    → launch sync_myheritage.mjs in background
 *
 * Requires:
 *   - Opera (or Chrome) running with --remote-debugging-port=9222 and a logged
 *     in MyHeritage tab.
 *   - node on PATH (or configurable below).
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

if (!is_cli()) {
    send_cors_headers();
}

function sync_status_file(): string
{
    return __DIR__ . '/../data/sync_status.json';
}

function sync_log_file(): string
{
    return __DIR__ . '/../data/sync_log.txt';
}

function read_status(): array
{
    $f = sync_status_file();
    if (!is_file($f)) {
        return ['state' => 'idle', 'message' => 'No sync has been run yet.', 'progress' => 0];
    }
    $cur = json_decode((string) file_get_contents($f), true);
    return is_array($cur) ? $cur : ['state' => 'idle', 'message' => 'Corrupt status file.', 'progress' => 0];
}

function node_bin(): string
{
    $env = getenv('FAMILYTREE_NODE') ?: getenv('SYNC_NODE_BIN');
    if ($env) return $env;
    // common Windows locations
    foreach ([
        'C:\\Program Files\\nodejs\\node.exe',
        'C:\\Program Files (x86)\\nodejs\\node.exe',
        (getenv('LOCALAPPDATA') ? getenv('LOCALAPPDATA') . '\\Programs\\nodejs\\node.exe' : ''),
    ] as $p) {
        if ($p !== '' && is_file($p)) return $p;
    }
    return 'node';
}

function launch_sync(): array
{
    $statusFile = sync_status_file();
    $logFile    = sync_log_file();

    // Don't start twice
    $cur = read_status();
    if (isset($cur['state']) && $cur['state'] === 'running') {
        return ['ok' => false, 'error' => 'A sync is already running.', 'status' => $cur];
    }

    $node = node_bin();

    // Abort hook so we can stop gracefully later
    $abortFile = __DIR__ . '/../data/sync_abort.txt';
    file_put_contents($abortFile, '');
    $env = array_merge($_SERVER, ['SYNC_ABORT_FILE' => $abortFile]);

    $script = __DIR__ . '/../sync_myheritage.mjs';
    $cmd = sprintf(
        '"%s" "%s" >> "%s" 2>&1',
        $node,
        $script,
        $logFile
    );

    // Launch detached on Windows so Apache doesn't wait for it
    $popenCmd = 'start /b cmd /c ' . $cmd;
    @pclose(popen($popenCmd, 'r'));

    return [
        'ok' => true,
        'launched' => true,
        'command' => ($node) . ' sync_myheritage.mjs',
        'status' => ['state' => 'starting', 'message' => 'Sync starting...', 'progress' => 0],
    ];
}

function abort_sync(): array
{
    $abortFile = __DIR__ . '/../data/sync_abort.txt';
    if (is_file($abortFile)) file_put_contents($abortFile, 'abort');
    $cur = read_status();
    if ($cur['state'] === 'running') {
        return ['ok' => true, 'message' => 'Abort requested.', 'status' => $cur];
    }
    return ['ok' => true, 'message' => 'No sync running.', 'status' => $cur];
}

$action = $_GET['action'] ?? 'status';

switch ($action) {
    case 'status':
        send_json(['ok' => true, 'status' => read_status()]);
        // no break

    case 'start':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            send_error('Use POST', 405);
        }
        $out = launch_sync();
        send_json($out, $out['ok'] ? 200 : 409);
        // no break

    case 'abort':
        send_json(abort_sync());
        // no break

    default:
        send_error("Unknown sync action: {$action}", 404);
}