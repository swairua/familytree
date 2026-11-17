<?php
/**
 * Import day-level dates from the tree into the events table.
 *
 * Usage: php import_tree_events.php
 *
 * Imports birthdays and death anniversaries for every individual with a
 * parseable full date (year-only entries are skipped). Re-runs are safe
 * because rows are keyed by (individual_id, type).
 *
 * Does not run as part of the web flow; it's an admin tool for bootstrapping.
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

$pdo = db();
if (php_sapi_name() !== 'cli') {
    send_error('CLI only', 403);
}

$importedB = 0;
$importedD = 0;

$parse = static function (string $date): ?array {
    $u = strtoupper(trim($date));
    if ($u === '') return null;
    $monthNames = ['JANUARY'=>1,'JAN'=>1,'FEBRUARY'=>2,'FEB'=>2,'MARCH'=>3,'MAR'=>3,'APRIL'=>4,'APR'=>4,
                   'MAY'=>5,'JUNE'=>6,'JULY'=>7,'AUGUST'=>8,'SEPTEMBER'=>9,'SEP'=>9,'OCTOBER'=>10,'OCT'=>10,
                   'NOVEMBER'=>11,'NOV'=>11,'DECEMBER'=>12,'DEC'=>12];
    foreach ($monthNames as $name => $num) {
        if (strpos($u, $name) !== false) {
            $clean = preg_replace('/(19|20)\d{2}/', ' ', $u);
            if (preg_match_all('/\b([1-9]|[12][0-9]|3[01])\b/', $clean, $dm)) {
                return ['month' => $num, 'day' => (int)$dm[1][0]];
            }
            return ['month' => $num, 'day' => null];
        }
    }
    return null;
};

$pdo->prepare("DELETE FROM events WHERE type IN ('birth_date','death_date') AND individual_id IS NOT NULL")->execute();

$w = static function (PDO $c, string $type, string $desc) use ($parse): void {
    $q = $c->query(
        "SELECT id, name, {$type} FROM individuals WHERE {$type} <> ''"
    );
    foreach ($q as $row) {
        $d = $parse((string)$row[$type]);
        if (!$d || $d['day'] === null) continue; // skip year-only
        $formatted = sprintf('%02d-%02d', $d['month'], $d['day']);
        $c->prepare(
            'INSERT INTO events (individual_id, type, date, description)
             VALUES (?, ?, ?, ?)'
        )->execute([$row['id'], $type, trim((string)$row['name']), $desc]);
    }
};

$w($pdo, 'birth_date', 'Birthday');
$w($pdo, 'death_date', 'Memorial');

echo "imported\n";
try {
    $s = $pdo->query("SELECT `type`, COUNT(*) AS c FROM events GROUP BY `type`");
    while ($r = $s->fetch()) {
        echo str_pad((string)$r['c'], 6) . " " . $r['type'] . "\n";
    }
    echo "total: " . $pdo->query("SELECT COUNT(*) FROM events")->fetchColumn() . "\n";
} catch (Throwable $e) {
    echo "events table not accessible: " . $e->getMessage() . "\n";
    exit(1);
}
exit(0);
