<?php
/**
 * AI proxy endpoint (Groq). Keeps the API key server-side.
 *
 * POST { "prompt": "..." }  -> { ok: true, text: "..." }
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
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error('Use POST', 405);
}

$body = read_json_body();
$prompt = trim((string) ($body['prompt'] ?? ''));
if ($prompt === '') {
    send_error('Missing prompt', 400);
}

$cfg = $GLOBALS['APP_CONFIG'] ?? [];
$local = [];
$localFile = __DIR__ . '/config.local.php';
if (is_file($localFile)) {
    $local = require $localFile;
}
$apiKey = $local['groq_api_key'] ?? '';

if ($apiKey === '' || $apiKey === 'YOUR_GROQ_API_KEY_HERE') {
    send_error('Groq API key not configured. Add groq_api_key to api/config.local.php.', 500);
}

$payload = [
    'model' => 'openai/gpt-oss-20b',
    'messages' => [
        ['role' => 'system', 'content' => 'You are a helpful genealogy research assistant. When asked to extract search filters, reply with ONLY a JSON object with keys: firstName, lastName, birthYear, place, keywords. No prose.'],
        ['role' => 'user', 'content' => $prompt],
    ],
    'temperature' => 0.2,
    'max_tokens' => 256,
];

$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_TIMEOUT => 30,
]);

$res = curl_exec($ch);
$err = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($res === false) {
    send_error('Groq request failed: ' . $err, 502);
}
$data = json_decode($res, true);
if (!is_array($data)) {
    send_error('Bad response from Groq', 502);
}
if ($code >= 400) {
    $msg = $data['error']['message'] ?? ('HTTP ' . $code);
    send_error('Groq error: ' . $msg, 502);
}
$text = $data['choices'][0]['message']['content'] ?? '';
send_json(['ok' => true, 'text' => $text]);