<?php
/**
 * Liens d'accès publics (Discord / Telegram / app formation) — pas de secrets.
 */
declare(strict_types=1);

require_once __DIR__ . '/admin-licence-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

$allowedOrigins = [
    'https://www.torinvest-trading.com',
    'https://torinvest-trading.com',
    'https://torinvest-trading.netlify.app',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true) || preg_match('/\.netlify\.app$/', parse_url($origin, PHP_URL_HOST) ?? '')) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

try {
    licenceCrmConfig();
    echo json_encode(['ok' => true, 'links' => licenceCrmAccessLinks()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
