<?php
/**
 * TORINVEST — API comptes membres du site.
 * Actions : register | login | me | logout
 */
declare(strict_types=1);

require_once __DIR__ . '/member-auth-lib.php';

$allowedOrigins = [
    'https://www.torinvest-trading.com',
    'https://torinvest-trading.com',
    'https://torinvest-trading.netlify.app',
    'https://radar.torinvest-trading.com',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originHost = parse_url($origin, PHP_URL_HOST) ?? '';
// Previews *.netlify.app désactivés : CORS + credentials = risque CSRF/lecture session
$isNetlifyPreview = false;
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

function memberAuthJson(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

try {
    memberAuthConfig();
} catch (Throwable $e) {
    memberAuthJson(['ok' => false, 'error' => 'service_unavailable'], 503);
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
        case 'register':
            if ($method !== 'POST') {
                memberAuthJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            memberAuthJson(memberAuthRegister(
                (string) ($input['email'] ?? ''),
                (string) ($input['password'] ?? ''),
                (string) ($input['displayName'] ?? $input['name'] ?? '')
            ));

        case 'login':
            if ($method !== 'POST') {
                memberAuthJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            memberAuthJson(memberAuthLogin(
                (string) ($input['email'] ?? ''),
                (string) ($input['password'] ?? '')
            ));

        case 'me':
            $session = memberAuthCurrentSession();
            if ($session === null) {
                memberAuthJson(['ok' => false, 'error' => 'unauthorized'], 401);
            }
            memberAuthJson($session);

        case 'logout':
            if ($method !== 'POST' && $method !== 'GET') {
                memberAuthJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            memberAuthJson(memberAuthLogout());

        default:
            memberAuthJson([
                'ok' => false,
                'error' => 'UNKNOWN_ACTION',
                'hint' => 'actions: register | login | me | logout',
            ], 400);
    }
} catch (InvalidArgumentException $e) {
    memberAuthJson(['ok' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    $code = $e->getMessage();
    $status = 400;
    if ($code === 'Trop de tentatives. Réessaie dans 15 minutes.') {
        $status = 429;
    }
    if ($code === 'identifiants_incorrects' || $code === 'unauthorized') {
        $status = 401;
    }
    memberAuthJson(['ok' => false, 'error' => $code], $status);
} catch (Throwable $e) {
    memberAuthJson(['ok' => false, 'error' => 'server_error'], 500);
}
