<?php
/**
 * Family Tree API - shared configuration & helpers
 * Reads local credentials from git-ignored config.local.php
 */

declare(strict_types=1);

// --- Local secrets (git-ignored) -------------------------------------------
$CONFIG = [];
$localConfig = __DIR__ . '/config.local.php';
if (is_file($localConfig)) {
    $CONFIG = require $localConfig;
}

const APP_DSN_DEFAULTS = [
    'host' => '127.0.0.1',
    'port' => '3308',
    'name' => 'familytree',
    'user' => 'familytree',
    'pass' => '',
];

$GLOBALS['APP_CONFIG'] = [
    'db_host' => $CONFIG['db_host'] ?? APP_DSN_DEFAULTS['host'],
    'db_port' => $CONFIG['db_port'] ?? APP_DSN_DEFAULTS['port'],
    'db_name' => $CONFIG['db_name'] ?? APP_DSN_DEFAULTS['name'],
    'db_user' => $CONFIG['db_user'] ?? APP_DSN_DEFAULTS['user'],
    'db_pass' => $CONFIG['db_password'] ?? APP_DSN_DEFAULTS['pass'],
    'allowed_origins' => $CONFIG['allowed_origins'] ?? [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],
];

function app_config(?string $key = null)
{
    $cfg = $GLOBALS['APP_CONFIG'];
    if ($key === null) return $cfg;
    return $cfg[$key] ?? null;
}

// --- PDO connection ---------------------------------------------------------
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $cfg = app_config();
    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $cfg['db_host'],
        $cfg['db_port'],
        $cfg['db_name']
    );

    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    return $pdo;
}

// --- CORS / HTTP helpers ------------------------------------------------------
function send_cors_headers(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = app_config('allowed_origins');
    if (in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    } else {
        header('Access-Control-Allow-Origin: *');
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
}

function send_json(mixed $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

function send_error(string $message, int $status = 400): void
{
    send_json(['ok' => false, 'error' => $message], $status);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function detect_sapi(): string
{
    return php_sapi_name();
}

function is_cli(): bool
{
    return in_array(php_sapi_name(), ['cli', 'phpdbg'], true);
}

// --- Date helpers -------------------------------------------------------------
function extract_year(?string $date): ?int
{
    if ($date === null || $date === '') return null;
    // "15 MAR 1950", "1950", "ABT 1920", "BET 1900 AND 1910", "1950-01-05"
    if (preg_match('/\b(19\d{2}|20\d{2}|1\d{3})\b/', $date, $m)) {
        return (int) $m[1];
    }
    if (preg_match('/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/', $date, $m)) {
        return (int) $m[1];
    }
    return null;
}
