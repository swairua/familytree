<?php
/**
 * RFC 5545 iCalendar (.ics) feed of TheWairuaHeritage family events.
 *
 *   GET calendar.php?action=status          (signed-in member) -> feed URLs
 *   GET calendar.php?token=<hex>            -> text/calendar (describe to podcasts/Google/Apple)
 *   GET calendar.php?token=<hex>&download=1 -> same, as an attachment
 *
 * The token lives in app_settings.calendar_token and is generated lazily on
 * the first status call. The feed is public once you have the token (standard
 * "secret iCal URL" practice); it contains only birthdays and wedding
 * anniversaries of the family tree.
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mail.php'; // app_public_url()

send_cors_headers();

$pdo = db();
$action = $_GET['action'] ?? null;

if ($action === 'status') {
    if (session_status() === PHP_SESSION_NONE) {
        session_name('FAMILYTREE_SESSION');
        session_start();
    }
    if (empty($_SESSION['user_id'])) send_error('You must be signed in', 401);

    $token = ensure_calendar_token($pdo);
    $url = app_public_url($pdo) . '/api/calendar.php?token=' . $token;
    send_json(['ok' => true, 'url' => $url, 'downloadUrl' => $url . '&download=1']);
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------
$token = (string)($_GET['token'] ?? '');
$stored = (string)app_setting($pdo, 'calendar_token', '');
if ($stored === '' || !hash_equals($stored, strtolower($token))) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'This calendar feed link is invalid. Open Family Events -> "Subscribe in Google Calendar" while signed in to get your link.';
    exit;
}

$events = [];

$sanitizeUid = static fn(string $id): string => preg_replace('/[^A-Za-z0-9_.-]/', '', $id) ?: 'x';

// Birthdays
foreach ($pdo->query("SELECT id, name, birth_date FROM individuals WHERE birth_date <> ''") as $row) {
    $d = parse_full_date((string)$row['birth_date']);
    if (!$d) continue;
    $events[] = [
        'uid' => 'birthday-' . $sanitizeUid((string)$row['id']) . '@wairuaheritage',
        'date' => $d,
        'summary' => 'Birthday: ' . trim((string)$row['name']),
    ];
}

// Wedding anniversaries (husband & wife both recorded)
$sql = "SELECT f.id, f.marriage_date, h.name AS hname, w.name AS wname
        FROM families f
        LEFT JOIN individuals h ON h.id = f.husband_id
        LEFT JOIN individuals w ON w.id = f.wife_id
        WHERE f.marriage_date <> ''";
foreach ($pdo->query($sql) as $row) {
    $d = parse_full_date((string)$row['marriage_date']);
    if (!$d) continue;
    $who = trim(implode(' & ', array_filter([trim((string)$row['hname']), trim((string)$row['wname'])], fn($s) => $s !== '')));
    $events[] = [
        'uid' => 'anniversary-' . $sanitizeUid((string)$row['id']) . '@wairuaheritage',
        'date' => $d,
        'summary' => 'Wedding anniversary: ' . ($who !== '' ? $who : 'Family couple'),
    ];
}

$now = gmdate('Ymd\THis\Z');
$lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TheWairuaHeritage//Family Events 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:TheWairuaHeritage - Family Events',
    'X-WR-CALDESC:Birthdays and wedding anniversaries in the family tree',
];
foreach ($events as $ev) {
    [$y, $mo, $d] = $ev['date'];
    $lines[] = 'BEGIN:VEVENT';
    $lines[] = 'UID:' . $ev['uid'];
    $lines[] = 'DTSTAMP:' . $now;
    $lines[] = sprintf('DTSTART;VALUE=DATE:%04d%02d%02d', $y, $mo, $d);
    $lines[] = 'RRULE:FREQ=YEARLY';
    $lines[] = 'SUMMARY:' . ics_escape($ev['summary']);
    $lines[] = 'TRANSP:TRANSPARENT';
    $lines[] = 'END:VEVENT';
}
$lines[] = 'END:VCALENDAR';
$ics = implode("\r\n", array_map('ics_fold', $lines)) . "\r\n";

header('Content-Type: text/calendar; charset=utf-8');
if (!empty($_GET['download'])) {
    header('Content-Disposition: attachment; filename="wairuaheritage-family-events.ics"');
} else {
    header('Content-Disposition: inline; filename="wairuaheritage-family-events.ics"');
}
header('Cache-Control: private, max-age=3600');
echo $ics;
exit;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function app_setting(PDO $pdo, string $key, ?string $default = null): ?string
{
    $s = $pdo->prepare('SELECT `value` FROM app_settings WHERE `key` = ?');
    $s->execute([$key]);
    $v = $s->fetchColumn();
    return $v === false ? $default : (string)$v;
}

function set_app_setting(PDO $pdo, string $key, string $value): void
{
    $s = $pdo->prepare('INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
    $s->execute([$key, $value]);
}

function ensure_calendar_token(PDO $pdo): string
{
    $token = (string)app_setting($pdo, 'calendar_token', '');
    if ($token === '') {
        $token = bin2hex(random_bytes(24));
        set_app_setting($pdo, 'calendar_token', $token);
    }
    return $token;
}

function parse_full_date(string $s): ?array
{
    $s = trim($s);
    if ($s === '') return null;
    $months = ['JAN'=>1,'FEB'=>2,'MAR'=>3,'APR'=>4,'MAY'=>5,'JUN'=>6,'JUL'=>7,'AUG'=>8,'SEP'=>9,'OCT'=>10,'NOV'=>11,'DEC'=>12];
    $monthNum = static fn(string $name): int => $months[strtoupper(substr($name, 0, 3))] ?? 0;

    // 15 MAR 1950 / 15 March 1950 / 1ST MARCH 2015 / ABT 15 MAR 1950
    if (preg_match('/\b(\d{1,2})(?:ST|ND|RD|TH)?\s*(?:OF\s+)?([A-Za-z]{3,9})[.,\s]*(\d{4})\b/i', $s, $m)) {
        $mo = $monthNum($m[2]);
        $d = (int)$m[1];
        if ($mo && checkdate($mo, $d, (int)$m[3])) return [(int)$m[3], $mo, $d];
    }
    // MAR 15 1950
    if (preg_match('/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:ST|ND|RD|TH)?[.,\s]*(\d{4})\b/i', $s, $m)) {
        $mo = $monthNum($m[1]);
        $d = (int)$m[2];
        if ($mo && checkdate($mo, $d, (int)$m[3])) return [(int)$m[3], $mo, $d];
    }
    // 1950-03-15
    if (preg_match('/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/', $s, $m)) {
        if (checkdate((int)$m[2], (int)$m[3], (int)$m[1])) return [(int)$m[1], (int)$m[2], (int)$m[3]];
    }
    // 15/03/1950 (day first, Kenyan convention); swap if month > 12
    if (preg_match('/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})\b/', $s, $m)) {
        $d = (int)$m[1];
        $mo = (int)$m[2];
        if ($mo > 12 && $d <= 12) { [$d, $mo] = [$mo, $d]; }
        if ($mo >= 1 && $mo <= 12 && checkdate($mo, $d, (int)$m[3])) return [(int)$m[3], $mo, $d];
    }
    return null;
}

function ics_escape(string $s): string
{
    $s = str_replace(['\\', ';', ','], ['\\\\', '\\;', '\\,'], $s);
    return str_replace(["\r\n", "\n", "\r"], '\\n', trim($s));
}

function ics_fold(string $line): string
{
    // RFC 5545: lines SHOULD NOT be longer than 75 octets; fold with CRLF + single space
    $out = '';
    while (strlen($line) > 75) {
        $out .= substr($line, 0, 75) . "\r\n ";
        $line = substr($line, 75);
    }
    return $out . $line;
}
