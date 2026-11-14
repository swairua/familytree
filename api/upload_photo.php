<?php
/**
 * Simple photo upload for a family-tree individual.
 *
 * POST multipart/form-data:
 *   individualId   string   individual id (e.g. @I2000158@)
 *   photo          file     image file (jpg|jpeg|png|gif|webp)
 */
declare(strict_types=1);

$MAX_BYTES = 8 * 1024 * 1024; // 8 MB
$ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
$EXT_MAP  = ['image/jpeg' => '.jpg', 'image/jpg' => '.jpg', 'image/png' => '.png', 'image/gif' => '.gif', 'image/webp' => '.webp'];
$UPLOAD_DIR = realpath(__DIR__ . '/../data/photos');

if ($UPLOAD_DIR === false) {
    $UPLOAD_DIR = __DIR__ . '/../data/photos';
    if (!is_dir($UPLOAD_DIR)) mkdir($UPLOAD_DIR, 0775, true);
    $UPLOAD_DIR = realpath($UPLOAD_DIR);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Use POST']);
    exit;
}

$individualId = trim((string)($_POST['individualId'] ?? ''));

if (!isset($_FILES['photo']) || !is_array($_FILES['photo'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Photo file is required']);
    exit;
}

$file = $_FILES['photo'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'File upload error: ' . $file['error']]);
    exit;
}
if ($file['size'] > $MAX_BYTES) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'File too large (max 8 MB)']);
    exit;
}
$mime = mime_content_type($file['tmp_name']);
if (!in_array($mime, $ALLOWED, true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Unsupported image type']);
    exit;
}

$ext  = $EXT_MAP[$mime] ?? '.jpg';
$safeId = $individualId !== '' ? preg_replace('/[^A-Za-z0-9_-]/', '_', $individualId) : 'photo';
$filename = $safeId . '_' . bin2hex(random_bytes(4)) . $ext;
$destination = $UPLOAD_DIR . '/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to save file']);
    exit;
}

echo json_encode(['ok' => true, 'file' => $filename]);