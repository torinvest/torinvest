<?php
/**
 * Provision automatique licences (formulaires activation + webhook Netlify optionnel).
 */
declare(strict_types=1);

require_once __DIR__ . '/admin-licence-lib.php';
require_once __DIR__ . '/rate-limit.php';

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
header('Access-Control-Allow-Headers: Content-Type, X-Provision-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function provisionJson(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    licenceCrmConfig();
} catch (Throwable $e) {
    provisionJson(['ok' => false, 'error' => $e->getMessage()], 503);
}

$cfg = licenceCrmConfig();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    provisionJson(['ok' => true, 'links' => licenceCrmAccessLinks()]);
}

if ($method !== 'POST') {
    provisionJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    $input = $_POST;
}

$action = (string) ($input['action'] ?? '');
$webhookSecret = (string) ($cfg['provision_webhook_secret'] ?? '');
$headerSecret = trim((string) ($_SERVER['HTTP_X_PROVISION_KEY'] ?? ''));
$isWebhook = $webhookSecret !== '' && hash_equals($webhookSecret, $headerSecret);

if (!$isWebhook) {
    if (empty($cfg['allow_form_provision'])) {
        provisionJson(['ok' => false, 'error' => 'form_provision_disabled'], 403);
    }
    torinvestRateLimitGuard('license_provision', 12, 3600);
}

try {
    switch ($action) {
        case 'provision_vip':
            $result = licenceCrmProvisionVipFromForm($input);
            provisionJson($result);

        case 'provision_accompagnement':
            $result = licenceCrmProvisionAccompagnementFromForm($input);
            provisionJson($result);

        case 'netlify_webhook':
            if (!$isWebhook) {
                provisionJson(['ok' => false, 'error' => 'unauthorized'], 401);
            }
            $formName = (string) ($input['form_name'] ?? $input['form-name'] ?? '');
            $data = $input['data'] ?? $input;
            if ($formName === 'activation-accompagnement-torinvest') {
                provisionJson(licenceCrmProvisionAccompagnementFromForm($data));
            }
            if ($formName === 'activation-torinvest') {
                provisionJson(licenceCrmProvisionVipFromForm($data));
            }
            provisionJson(['ok' => false, 'error' => 'form_inconnu'], 400);

        default:
            provisionJson(['ok' => false, 'error' => 'action_inconnue'], 400);
    }
} catch (InvalidArgumentException $e) {
    if (!$isWebhook) {
        torinvestRateLimitHit('license_provision');
    }
    provisionJson(['ok' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    provisionJson(['ok' => false, 'error' => $e->getMessage()], 500);
} catch (Throwable $e) {
    provisionJson(['ok' => false, 'error' => $e->getMessage()], 500);
}
