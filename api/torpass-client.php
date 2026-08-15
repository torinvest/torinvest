<?php
/**
 * TORINVEST — API TorPass client (Discord invite + abonnements € liés au wallet).
 * Hébergement : radar.torinvest-trading.com (proxy Netlify 200!).
 */
declare(strict_types=1);

require_once __DIR__ . '/torpass-client-lib.php';

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

function torpassClientJson(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

try {
    licenceCrmConfig();
} catch (Throwable $e) {
    torpassClientJson(['ok' => false, 'error' => $e->getMessage()], 503);
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
        case 'links':
            $links = licenceCrmAccessLinks();
            torpassClientJson([
                'ok' => true,
                'discordInviteUrl' => (string) ($links['discordPublic'] ?? ''),
                'discordAccompagnementUrl' => (string) ($links['discordAccompagnement'] ?? ''),
                'discordNote' =>
                    'Accès Discord privé éligible selon ton niveau TorPass. ' .
                    'Le rôle n’est pas encore attribué automatiquement.',
            ]);

        case 'status':
            if ($method !== 'POST' && $method !== 'GET') {
                torpassClientJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            $wallet = (string) ($input['wallet'] ?? $_GET['wallet'] ?? '');
            torpassClientJson(torpassClientStatusForWallet($wallet));

        case 'link_license':
            if ($method !== 'POST') {
                torpassClientJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            torpassClientJson(torpassClientLinkLicense(
                (string) ($input['wallet'] ?? ''),
                (string) ($input['licenseKey'] ?? $input['license'] ?? ''),
                (string) ($input['email'] ?? '')
            ));

        default:
            torpassClientJson([
                'ok' => false,
                'error' => 'UNKNOWN_ACTION',
                'hint' => 'actions: links | status | link_license',
            ], 400);
    }
} catch (InvalidArgumentException $e) {
    torpassClientJson(['ok' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    $code = $e->getMessage();
    $status = 400;
    if ($code === 'Trop de tentatives. Réessaie dans 15 minutes.') {
        $status = 429;
    }
    torpassClientJson(['ok' => false, 'error' => $code], $status);
} catch (Throwable $e) {
    torpassClientJson(['ok' => false, 'error' => 'server_error', 'detail' => $e->getMessage()], 500);
}
