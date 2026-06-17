<?php
/**
 * TORINVEST — API accès accompagnement (session HttpOnly, Crypto Radar).
 */
declare(strict_types=1);

require_once __DIR__ . '/accompagnement-access-lib.php';
require_once __DIR__ . '/http-session.php';

$allowedOrigins = [
    'https://www.torinvest-trading.com',
    'https://torinvest-trading.com',
    'https://torinvest-trading.netlify.app',
    'https://radar.torinvest-trading.com',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originHost = parse_url($origin, PHP_URL_HOST) ?? '';
$isNetlifyPreview = (bool) preg_match('/\.netlify\.app$/', $originHost);
if (in_array($origin, $allowedOrigins, true) || $isNetlifyPreview) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function accompagnementAccessJson(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function accompagnementAccessRequireSession(): array
{
    $session = accompagnementAccessReadSession();
    if ($session === null) {
        accompagnementAccessJson(['ok' => false, 'error' => 'unauthorized'], 401);
    }
    return $session;
}

try {
    accompagnementAccessConfig();
} catch (Throwable $e) {
    accompagnementAccessJson(['ok' => false, 'error' => $e->getMessage()], 503);
}

$method = $_SERVER['REQUEST_METHOD'];
$input = [];
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($input)) {
        $input = [];
    }
}
$action = (string) ($input['action'] ?? $_GET['action'] ?? '');

try {
    switch ($action) {
        case 'login_client':
            if ($method !== 'POST') {
                accompagnementAccessJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            accompagnementAccessJson(accompagnementAccessLoginClient(
                (string) ($input['email'] ?? ''),
                (string) ($input['licenseKey'] ?? $input['license'] ?? '')
            ));

        case 'login_admin':
            if ($method !== 'POST') {
                accompagnementAccessJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            accompagnementAccessJson(accompagnementAccessLoginAdmin((string) ($input['pin'] ?? '')));

        case 'logout':
            if ($method !== 'POST') {
                accompagnementAccessJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            torinvestSessionClearCookie('accompagnement_access');
            accompagnementAccessJson(['ok' => true]);

        case 'ping':
            $session = accompagnementAccessRequireSession();
            accompagnementAccessJson(accompagnementAccessPing($session));

        default:
            accompagnementAccessJson(['ok' => false, 'error' => 'action_inconnue'], 400);
    }
} catch (InvalidArgumentException $e) {
    accompagnementAccessJson(['ok' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    $status = str_contains($e->getMessage(), 'Trop de tentatives') ? 429 : 403;
    accompagnementAccessJson(['ok' => false, 'error' => $e->getMessage()], $status);
} catch (Throwable $e) {
    accompagnementAccessJson(['ok' => false, 'error' => $e->getMessage()], 500);
}
