<?php
/**
 * API session Trading Journal — login_formation_bridge / ping / logout.
 */
declare(strict_types=1);

require_once __DIR__ . '/journal-access-lib.php';
require_once __DIR__ . '/http-session.php';

$allowedOrigins = [
    'https://www.torinvest-trading.com',
    'https://torinvest-trading.com',
    'https://torinvest-trading.netlify.app',
    'https://radar.torinvest-trading.com',
    'https://app.torinvest-trading.com',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originHost = parse_url($origin, PHP_URL_HOST) ?? '';
$isNetlifyPreview = (bool) preg_match('/\.netlify\.app$/', (string) $originHost);
if (($origin !== '' && in_array($origin, $allowedOrigins, true)) || $isNetlifyPreview) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function journalJson(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    journalConfig();
} catch (Throwable $e) {
    journalJson(['ok' => false, 'error' => $e->getMessage()], 503);
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
        case 'login_formation_bridge':
            if ($method !== 'POST') {
                journalJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            journalJson(journalLoginFormationBridge((string) ($input['bridgeToken'] ?? '')));

        case 'logout':
            if ($method !== 'POST') {
                journalJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            torinvestSessionClearCookie('journal_access');
            journalJson(['ok' => true]);

        case 'ping':
            $session = journalRequireSession();
            journalJson(journalPing($session));

        case 'config':
            journalJson([
                'ok' => true,
                'app' => 'journal',
                'access' => 'forge_premium',
            ]);

        default:
            journalJson(['ok' => false, 'error' => 'action_inconnue'], 400);
    }
} catch (JournalAccessException $e) {
    journalJson($e->payload, $e->getCode() > 0 ? $e->getCode() : 403);
} catch (InvalidArgumentException $e) {
    journalJson(['ok' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    $msg = $e->getMessage();
    $status = 403;
    if ($msg === 'unauthorized') {
        $status = 401;
    } elseif (str_contains($msg, 'Trop de tentatives')) {
        $status = 429;
    }
    journalJson(['ok' => false, 'error' => $msg], $status);
} catch (Throwable $e) {
    journalJson(['ok' => false, 'error' => $e->getMessage()], 500);
}
