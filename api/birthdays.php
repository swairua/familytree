<?php
/**
 * Birthday reminder engine for TheWairuaHeritage.
 *
 * Web:
 *   GET  birthdays.php?action=list&days=30          (auth)    → upcoming birthdays
 *   POST birthdays.php?action=send&days=30          (admin)   → email active members
 *   POST birthdays.php?action=notify&days=30        (session) → same as send but for member
 *
 * CLI:
 *   php birthdays.php daily                              → send if not already sent today
 *   php birthdays.php list [--days=30]                   → print upcoming
 *   php birthdays.php send [--days=30]                   → send now
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mail.php';

$isCli = php_sapi_name() === 'cli';

if (!$isCli) {
    send_cors_headers();
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    session_name('FAMILYTREE_SESSION');
    session_start();
    $uid = $_SESSION['user_id'] ?? null;
    if (!$uid) send_error('You must be signed in', 401);
    $stmt = db()->prepare('SELECT id, role FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $me = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$me) send_error('Invalid session', 401);
}

const MONTHS = [
    'JANUARY'=>1,'JAN'=>1,'FEBRUARY'=>2,'FEB'=>2,'MARCH'=>3,'MAR'=>3,'APRIL'=>4,'APR'=>4,
    'MAY'=>5,'JUNE'=>6,'JULY'=>7,'JUL'=>7,'AUGUST'=>8,'AUG'=>8,'SEPTEMBER'=>9,'SEP'=>9,
    'OCTOBER'=>10,'OCT'=>10,'NOVEMBER'=>11,'NOV'=>11,'DECEMBER'=>12,'DEC'=>12,
];

function parse_birth(?string $date): ?array
{
    if (!$date) return null;
    $u = strtoupper(trim($date));
    $month = null;
    foreach (MONTHS as $name => $num) {
        if (strpos($u, $name) !== false) { $month = $num; break; }
    }
    if ($month === null) return null;
    $clean = preg_replace('/(19|20)\d{2}/', ' ', $u);
    if (preg_match_all('/\b([1-9]|[12][0-9]|3[01])\b/', $clean, $dm)) {
        foreach ($dm[1] as $cand) {
            if ((int)$cand >= 1 && (int)$cand <= 31) {
                return ['month' => $month, 'day' => (int)$cand];
            }
        }
    }
    return ['month' => $month, 'day' => null];
}

function collect_upcoming(PDO $pdo, int $days): array
{
    $now = new DateTimeImmutable('today');
    $end = $now->modify('+' . max(0, (int)$days) . ' days');
    $out = [];
    foreach ($pdo->query("SELECT id, name, birth_date, gender FROM individuals WHERE birth_date <> ''") as $r) {
        $p = parse_birth($r['birth_date']);
        if (!$p || !$p['day']) continue;
        for ($d = $now; $d <= $end; $d = $d->modify('+1 day')) {
            if ((int)$d->format('n') === $p['month'] && (int)$d->format('j') === $p['day']) {
                $age = null;
                if (preg_match('/(19|20)\d{2}/', (string)$r['birth_date'], $m)) {
                    $age = (int)$d->format('Y') - (int)$m[0];
                }
                $out[] = [
                    'id' => $r['id'],
                    'name' => $r['name'],
                    'birth_date' => $r['birth_date'],
                    'date' => $d->format('Y-m-d'),
                    'age' => $age,
                    'gender' => $r['gender'],
                ];
                break; // one birthday per year
            }
        }
    }
    usort($out, fn($a, $b) => strcmp((string)$a['date'], (string)$b['date']));
    return $out;
}

function birthday_html(array $list): string
{
    if (!$list) {
        return '<p>No birthdays in the selected window.</p>';
    }
    $items = '';
    foreach ($list as $p) {
        $age = $p['age'] !== null ? ' \u{1F382} Turns <strong>' . (int)$p['age'] . '</strong>' : '';
        $items .= '<li style="margin:8px 0;"><strong>'
            . htmlspecialchars($p['name'], ENT_QUOTES, 'UTF-8') . '</strong><br>'
            . '<span style="color:#8b837d;font-size:13px;">'
            . htmlspecialchars($p['birth_date'], ENT_QUOTES, 'UTF-8')
            . ' · ' . htmlspecialchars($p['date'], ENT_QUOTES, 'UTF-8')
            . $age . '</span></li>';
    }
    return '<ul style="list-style:none;padding:0;">' . $items . '</ul>'
        . '<p style="font-size:13px;color:#8b837d;margin-top:14px;">Go say happy birthday!</p>';
}

function send_birthday_digest(PDO $pdo, int $days): array
{
    $list = collect_upcoming($pdo, $days);
    $today = new DateTimeImmutable('today');
    $windowLabel = $today->format('j M') . ' – ' . $today->modify('+' . $days . ' days')->format('j M Y');
    $body = '<p>The next <strong>' . $days . '</strong> days bring birthdays for our family:</p>'
        . birthday_html($list);
    $sent = 0;
    $skipped = 0;
    foreach ($pdo->query("SELECT id, email, display_name FROM users WHERE status = 'active'") as $u) {
        if (!email_is_real((string)$u['email'])) { $skipped++; continue; }
        $result = app_send_branded($pdo, (string)$u['email'],
            'Birthday reminders: ' . $windowLabel,
            'Upcoming birthdays',
            'This month in our family',
            $body);
        if ($result['ok']) $sent++; else $skipped++;
    }
    return ['ok' => true, 'sent' => $sent, 'skipped' => $skipped, 'birthdays' => count($list)];
}

function cli_cmd(): string
{
    global $argv;
    return isset($argv[1]) ? strtolower((string)$argv[1]) : 'list';
}

function cli_arg(string $name, mixed $default = null): mixed
{
    global $argv;
    $prefix = '--' . $name . '=';
    foreach ($argv as $arg) {
        if (str_starts_with((string)$arg, $prefix)) {
            return substr((string)$arg, strlen($prefix));
        }
    }
    return $default;
}

$action = isset($argv) ? cli_cmd() : ($_GET['action'] ?? 'list');
$days = isset($argv) ? (int)cli_arg('days', 14) : (int)($_GET['days'] ?? $_POST['days'] ?? 14);
$days = max(1, min(365, $days));

if ($isCli) {
    $pdo = db();
    switch ($action) {
        case 'daily':
            $today = (new DateTimeImmutable('today'))->format('Y-m-d');
            $stmt = $pdo->prepare("SELECT `value` FROM app_settings WHERE `key` = 'birthday_last_sent'");
            $stmt->execute();
            $last = (string)($stmt->fetchColumn() ?: '');
            $s = $pdo->query("SELECT `value` FROM app_settings WHERE `key` = 'birthday_lead_days'")->fetchColumn();
            $lead = $s !== false ? (int)$s : 14;
            if ($last === $today) {
                echo "Already sent today ({$today}).\n";
                exit(0);
            }
            $pdo->prepare("INSERT INTO app_settings (`key`, `value`) VALUES ('birthday_last_sent', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)")
                ->execute([$today]);
            $result = send_birthday_digest($pdo, $lead);
            echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
            exit(0);
        case 'list':
            $list = collect_upcoming($pdo, $days);
            foreach ($list as $b) {
                echo str_pad($b['date'], 12), ' ', str_pad((string)($b['age'] ?? ''), 5), ' ', substr($b['name'], 0, 40), '  (', $b['birth_date'], ")\n";
            }
            echo count($list), " upcoming\n";
            exit(0);
        case 'send':
            print_r(send_birthday_digest($pdo, $days));
            exit(0);
        default:
            fwrite(STDERR, "Usage: php birthdays.php [daily|list|send] [--days=N]\n");
            exit(1);
    }
}

$pdo = db();
$days = max(1, min(365, $days));
switch ($action) {
    case 'list':
        send_json(['ok' => true, 'birthdays' => collect_upcoming($pdo, $days)]);
        break;
    case 'send':
        if (($me['role'] ?? '') !== 'admin') send_error('Administrator access required', 403);
        send_json(send_birthday_digest($pdo, $days));
        break;
    default:
        send_error('Unknown action', 404);
}
