<?php
/**
 * TORINVEST — Discord TorPass (OAuth + rôles KRM).
 * Actions : status | challenge | start | callback
 */
declare(strict_types=1);

require_once __DIR__ . '/discord-torpass-lib.php';

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

function discordTorpassJson(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function discordTorpassRedirect(string $url): void
{
    header('Location: ' . $url, true, 302);
    exit;
}

try {
    discordTorpassConfig();
} catch (Throwable $e) {
    discordTorpassJson(['ok' => false, 'error' => $e->getMessage()], 503);
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
        case 'status':
            discordTorpassJson(discordTorpassStatus());

        case 'challenge':
            if ($method !== 'POST') {
                discordTorpassJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            discordTorpassJson(discordTorpassCreateChallenge((string) ($input['wallet'] ?? '')));

        case 'start':
            if ($method !== 'POST') {
                discordTorpassJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
            }
            discordTorpassJson(discordTorpassStart(
                (string) ($input['wallet'] ?? ''),
                (string) ($input['signature'] ?? ''),
                (string) ($input['message'] ?? ''),
                (string) ($input['nonce'] ?? '')
            ));

        case 'callback':
            // OAuth redirect from Discord (GET)
            $err = (string) ($_GET['error'] ?? '');
            if ($err !== '') {
                discordTorpassRedirect(discordTorpassErrorUrl() . '&reason=' . rawurlencode($err));
            }
            $code = (string) ($_GET['code'] ?? '');
            $state = (string) ($_GET['state'] ?? '');
            if ($code === '' || $state === '') {
                discordTorpassRedirect(discordTorpassErrorUrl() . '&reason=missing_code');
            }
            try {
                discordTorpassHandleCallback($code, $state);
                discordTorpassRedirect(discordTorpassSuccessUrl());
            } catch (Throwable $e) {
                discordTorpassRedirect(
                    discordTorpassErrorUrl() . '&reason=' . rawurlencode($e->getMessage())
                );
            }

        default:
            discordTorpassJson([
                'ok' => false,
                'error' => 'UNKNOWN_ACTION',
                'hint' => 'actions: status | challenge | start | callback',
            ], 400);
    }
} catch (InvalidArgumentException $e) {
    discordTorpassJson(['ok' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    $code = $e->getMessage();
    $status = 400;
    if ($code === 'Trop de tentatives. Réessaie dans 15 minutes.') {
        $status = 429;
    }
    if ($code === 'krm_insuffisant_community') {
        $status = 403;
    }
    if ($code === 'discord_torpass_not_configured') {
        $status = 503;
    }
    discordTorpassJson([
        'ok' => false,
        'error' => $code,
        'inviteUrl' => discordTorpassInviteUrl(),
    ], $status);
} catch (Throwable $e) {
    discordTorpassJson(['ok' => false, 'error' => 'server_error', 'detail' => $e->getMessage()], 500);
}
