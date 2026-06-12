<?php
/**
 * TORINVEST — API AI Access sécurisée (radar.torinvest-trading.com).
 * Auth licence client + PIN admin, ping session, proxy /ai/chat.
 */
declare(strict_types=1);

require_once __DIR__ . '/ai-access-lib.php';
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

function aiAccessJson(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function aiAccessBearerToken(): string
{
    $cookie = torinvestSessionReadCookie('ai_access');
    if ($cookie !== '') {
        return $cookie;
    }
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
        return '';
    }
    return trim($m[1]);
}

function aiAccessRequireSession(): array
{
    $token = aiAccessBearerToken();
    if ($token === '') {
        aiAccessJson(['ok' => false, 'error' => 'unauthorized'], 401);
    }
    try {
        $secret = aiAccessHmacSecret();
    } catch (Throwable $e) {
        aiAccessJson(['ok' => false, 'error' => $e->getMessage()], 503);
    }
    $session = aiAccessVerifyToken($token, $secret);
    if ($session === null) {
        aiAccessJson(['ok' => false, 'error' => 'session_expired'], 401);
    }
    $session['token'] = $token;
    return $session;
}

try {
    aiAccessConfig();
} catch (Throwable $e) {
    aiAccessJson(['ok' => false, 'error' => $e->getMessage()], 503);
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
                aiAccessJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            $login = aiAccessLoginClient(
                (string) ($input['licenseKey'] ?? ''),
                trim((string) ($input['mt5Account'] ?? ''))
            );
            aiAccessJson($login);

        case 'login_admin':
            if ($method !== 'POST') {
                aiAccessJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            $login = aiAccessLoginAdmin((string) ($input['pin'] ?? ''));
            aiAccessJson($login);

        case 'logout':
            if ($method !== 'POST') {
                aiAccessJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            torinvestSessionClearCookie('ai_access');
            aiAccessJson(['ok' => true]);

        case 'ping':
            $session = aiAccessRequireSession();
            aiAccessJson(aiAccessPing($session));

        case 'chat':
            if ($method !== 'POST') {
                aiAccessJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            $session = aiAccessRequireSession();
            $input['_token'] = $session['token'];
            aiAccessJson(aiAccessProxyChat($session, $input));

        default:
            aiAccessJson(['ok' => false, 'error' => 'action_inconnue'], 400);
    }
} catch (InvalidArgumentException $e) {
    aiAccessJson(['ok' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    aiAccessJson(['ok' => false, 'error' => $e->getMessage()], 403);
} catch (Throwable $e) {
    aiAccessJson(['ok' => false, 'error' => $e->getMessage()], 500);
}
