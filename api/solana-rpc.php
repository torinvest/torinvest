<?php
/**
 * Proxy JSON-RPC Solana — masque la clé Helius côté serveur.
 * Utilisé par torpass.html, premium.html et exercices.html pour lire
 * les soldes KRM/ORAX dans le wallet Phantom (lecture seule).
 */
header('Content-Type: application/json; charset=utf-8');
$allowedOrigins = [
    'https://www.torinvest-trading.com',
    'https://torinvest-trading.com',
    'https://torinvest-trading.netlify.app',
    'https://radar.torinvest-trading.com',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originHost = parse_url($origin, PHP_URL_HOST) ?? '';
$isNetlifyPreview = (bool) preg_match('/\.netlify\.app$/', $originHost);
$originAllowed = ($origin === '') || in_array($origin, $allowedOrigins, true) || $isNetlifyPreview;

if (!$originAllowed) {
    http_response_code(403);
    echo json_encode(['error' => 'Origin non autorisée']);
    exit;
}

if ($origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Origin, solana-client, Solana-Client');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
    exit;
}

require_once __DIR__ . '/rate-limit.php';
try {
    // TorPass ≈ 2–4 appels RPC par connexion ; limite abus Helius
    torinvestRateLimitGuard('solana_rpc', 90, 60);
} catch (RuntimeException $e) {
    http_response_code(429);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}
torinvestRateLimitHit('solana_rpc');

$configFile = __DIR__ . '/config.local.php';
if (!file_exists($configFile)) {
    http_response_code(503);
    echo json_encode(['error' => 'Configuration RPC manquante. Copiez api/config.example.php vers api/config.local.php']);
    exit;
}

$config = require $configFile;
$apiKey = $config['helius_api_key'] ?? '';

if (empty($apiKey) || $apiKey === 'VOTRE_CLE_HELIUS_ICI') {
    http_response_code(503);
    echo json_encode(['error' => 'Clé Helius non configurée']);
    exit;
}

$body = file_get_contents('php://input');
if ($body === false || $body === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Corps de requête vide']);
    exit;
}

$payload = json_decode($body, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON invalide']);
    exit;
}

// Méthodes autorisées (lecture seule — pas de signature de transaction)
$allowedMethods = [
    'getAccountInfo',
    'getBalance',
    'getTokenAccountsByOwner',
    'getParsedTokenAccountsByOwner',
    'getLatestBlockhash',
    'getSlot',
    'getHealth',
];

$method = $payload['method'] ?? '';
if (!in_array($method, $allowedMethods, true)) {
    http_response_code(403);
    echo json_encode([
        'jsonrpc' => '2.0',
        'id' => $payload['id'] ?? null,
        'error' => ['code' => -32601, 'message' => 'Méthode non autorisée via ce proxy'],
    ]);
    exit;
}

$heliusUrl = 'https://mainnet.helius-rpc.com/?api-key=' . urlencode($apiKey);

$ch = curl_init($heliusUrl);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Erreur proxy RPC', 'detail' => $curlError]);
    exit;
}

http_response_code($httpCode >= 100 ? $httpCode : 200);
echo $response;
