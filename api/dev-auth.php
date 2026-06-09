<?php
/**
 * Authentification développeur pour AITORINVEST2.html
 * Valide un PIN et retourne un token de session (localStorage côté client).
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$configFile = __DIR__ . '/config.local.php';
if (!file_exists($configFile)) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'Configuration manquante']);
    exit;
}

$config = require $configFile;
$expectedPin = $config['dev_access_pin'] ?? '';
$ttl = (int) ($config['dev_session_ttl'] ?? 604800);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Vérification d'un token existant
    $token = $_GET['token'] ?? '';
    if (empty($token)) {
        echo json_encode(['ok' => false]);
        exit;
    }
    $valid = verifyDevToken($token, $expectedPin);
    echo json_encode(['ok' => $valid]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Méthode non autorisée']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$pin = trim($input['pin'] ?? '');

if ($pin === '' || !hash_equals($expectedPin, $pin)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Code incorrect']);
    exit;
}

$expiresAt = time() + $ttl;
$token = generateDevToken($expiresAt, $expectedPin);

echo json_encode([
    'ok' => true,
    'token' => $token,
    'expiresAt' => $expiresAt,
]);

function generateDevToken(int $expiresAt, string $secret): string
{
    $payload = $expiresAt . '.' . bin2hex(random_bytes(16));
    $sig = hash_hmac('sha256', $payload, $secret);
    return base64_encode($payload . '.' . $sig);
}

function verifyDevToken(string $token, string $secret): bool
{
    $decoded = base64_decode($token, true);
    if ($decoded === false) {
        return false;
    }

    $parts = explode('.', $decoded);
    if (count($parts) !== 3) {
        return false;
    }

    [$expiresAt, $nonce, $sig] = $parts;
    $payload = $expiresAt . '.' . $nonce;
    $expected = hash_hmac('sha256', $payload, $secret);

    if (!hash_equals($expected, $sig)) {
        return false;
    }

    return (int) $expiresAt > time();
}
