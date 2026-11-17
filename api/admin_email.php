<?php
/**
 * Admin: send a custom email to family members.
 *
 *   POST admin_email.php?action=send
 *       { recipients: 'all' }                          -> every active/pending member with a real address
 *       { recipients: 'selected', user_ids: [1,2,...] } -> those members only
 *       { subject, body }                              -> both required
 *
 * Delivery rules (same as everything else the site sends):
 *   - placeholder / invalid addresses (@placeholder.invalid) are skipped;
 *   - members who unsubscribed from notification emails are skipped (kind='notification');
 *   - the email carries the standard branded footer + unsubscribe link.
 * Returns per-recipient outcome counts; individual failures never stop the batch.
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_lib.php';
require_once __DIR__ . '/mail.php';

send_cors_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const MAX_RECIPIENTS = 200;
const MAX_IDS = 100;
const MAX_SUBJECT = 150;
const MAX_BODY = 5000;

try {
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        send_error('Use POST', 405);
    }
    // Admin gate
    $me = require_active_session_user($pdo);
    if (($me['role'] ?? '') !== 'admin') {
        send_error('Administrator access required', 403);
    }

    $body = read_json_body();
    $subject = trim((string)($body['subject'] ?? ''));
    $text = trim((string)($body['body'] ?? ''));
    $recipients = (string)($body['recipients'] ?? 'all');

    if ($subject === '') send_error('Subject is required', 400);
    if (mb_strlen($subject) > MAX_SUBJECT) send_error('Subject is too long (max ' . MAX_SUBJECT . ' characters)', 400);
    if ($text === '') send_error('Body is required', 400);
    if (mb_strlen($text) > MAX_BODY) send_error('Body is too long (max ' . MAX_BODY . ' characters)', 400);

    if ($recipients === 'all') {
        $stmt = $pdo->query(
            "SELECT id, email, display_name FROM users WHERE status IN ('active', 'pending') ORDER BY display_name ASC"
        );
        $targets = $stmt->fetchAll();
    } elseif ($recipients === 'selected') {
        $ids = $body['user_ids'] ?? [];
        if (!is_array($ids) || count($ids) === 0) {
            send_error('Pick at least one member', 400);
        }
        if (count($ids) > MAX_IDS) send_error('Select at most ' . MAX_IDS . ' members at a time', 400);
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $place = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare(
            "SELECT id, email, display_name FROM users WHERE status IN ('active', 'pending') AND id IN ($place)"
        );
        $stmt->execute($ids);
        $targets = $stmt->fetchAll();
    } else {
        send_error("recipients must be 'all' or 'selected'", 400);
    }

    $sent = 0;
    $skippedPlaceholder = 0;
    $skippedUnsubscribed = 0;
    $failures = [];

    foreach ($targets as $t) {
        if ($sent + count($failures) + $skippedUnsubscribed + $skippedPlaceholder >= MAX_RECIPIENTS) break;
        $email = trim((string)$t['email']);
        if (!email_is_real($email)) {
            $skippedPlaceholder++;
            continue;
        }
        try {
            $name = trim((string)($t['display_name'] ?? ''));
            $greeting = $name !== ''
                ? '<p>Hi ' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . ',</p>'
                : '';
            $html = $greeting
                . '<p>' . nl2br(htmlspecialchars($text, ENT_QUOTES, 'UTF-8')) . '</p>'
                . app_button('Open TheWairuaHeritage', app_public_url($pdo));
            $result = app_send_branded(
                $pdo,
                $email,
                $subject,
                $subject,
                $subject,
                $html,
                null,
                'notification'
            );
            if (!empty($result['skipped'])) {
                $skippedUnsubscribed++;
            } elseif (!empty($result['ok'])) {
                $sent++;
            } else {
                $failures[$email] = (string)($result['error'] ?? 'send failed');
            }
        } catch (Throwable $e) {
            $failures[$email] = $e->getMessage();
        }
    }

    send_json([
        'ok' => true,
        'sent' => $sent,
        'skippedPlaceholder' => $skippedPlaceholder,
        'skippedUnsubscribed' => $skippedUnsubscribed,
        'failures' => array_slice($failures, 0, 20, true),
    ]);
} catch (Throwable $e) {
    send_error('Server error: ' . $e->getMessage(), 500);
}
