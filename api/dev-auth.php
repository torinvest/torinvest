<?php
/**
 * Authentification développeur (legacy AITORINVEST2) — durci.
 * Préférer ai-access.html + api/ai-access.php pour les nouveaux flux.
 */
declare(strict_types=1);

require_once __DIR__ . '/rate-limit.php';

header('Content-Type: application/json; charset=utf-8');
$allowedOrigins = [
    'https://www.torinvest-trading.com',
    'https://torinvest-trading.com',
    'https://torinvest-trading.netlify.app',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originHost = parse_url($origin, PHP_URL_HOST) ?? '';
// Previews *.netlify.app désactivés : CORS + credentials = risque CSRF/lecture session
$isNetlifyPreview = false;
if (in_array($origin, $allowedOrigins, true) || $isNetlifyPreview) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
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
$hmacSecret = (string) ($config['dev_session_hmac_secret'] ?? '');
if ($hmacSecret === '') {
    $hmacSecret = hash('sha256', 'torinvest-dev:' . $expectedPin);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = $_GET['token'] ?? '';
    if (empty($token)) {
        echo json_encode(['ok' => false]);
        exit;
    }
    $valid = verifyDevToken($token, $hmacSecret);
    echo json_encode(['ok' => $valid]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Méthode non autorisée']);
    exit;
}

torinvestRateLimitGuard('dev_auth_pin', 8, 900);

$input = json_decode(file_get_contents('php://input'), true);
$pin = trim($input['pin'] ?? '');

if ($pin === '' || !hash_equals($expectedPin, $pin)) {
    torinvestRateLimitHit('dev_auth_pin');
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Code incorrect']);
    exit;
}

$expiresAt = time() + $ttl;
$token = generateDevToken($expiresAt, $hmacSecret);

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
