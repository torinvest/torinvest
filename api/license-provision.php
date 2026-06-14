<?php
/**
 * Provision automatique licences (formulaires activation + webhook Netlify).
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

function provisionPublicError(Throwable $e, bool $isWebhook): void
{
    if ($isWebhook) {
        provisionJson(['ok' => false, 'error' => $e->getMessage()], $e instanceof InvalidArgumentException ? 400 : 500);
    }
    provisionJson(['ok' => false, 'error' => 'provision_failed'], $e instanceof InvalidArgumentException ? 400 : 500);
}

try {
    licenceCrmConfig();
} catch (Throwable $e) {
    provisionJson(['ok' => false, 'error' => 'service_unavailable'], 503);
}

$cfg = licenceCrmConfig();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    provisionJson(['ok' => true, 'links' => licenceCrmAccessLinks()]);
}

if ($method !== 'POST') {
    provisionJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$rawBody = file_get_contents('php://input') ?: '{}';
$input = json_decode($rawBody, true);
if (!is_array($input)) {
    $input = $_POST;
}

$isWebhook = licenceProvisionIsWebhookRequest();
$action = (string) ($input['action'] ?? '');
$netlifyPayload = licenceProvisionParseNetlifyPayload($input);

if ($isWebhook && ($action === '' || $action === 'netlify_webhook') && $netlifyPayload !== null) {
    $action = 'netlify_webhook';
}

if (!$isWebhook) {
    $requireWebhook = !empty($cfg['require_webhook_provision']) && licenceProvisionWebhookSecret() !== '';
    if ($requireWebhook || empty($cfg['allow_form_provision'])) {
        provisionJson(['ok' => false, 'error' => 'form_provision_disabled'], 403);
    }
    try {
        torinvestRateLimitGuard('license_provision', 12, 3600);
    } catch (Throwable $e) {
        provisionJson(['ok' => false, 'error' => 'rate_limited'], 429);
    }
}

try {
    switch ($action) {
        case 'netlify_webhook':
            if (!$isWebhook) {
                provisionJson(['ok' => false, 'error' => 'unauthorized'], 401);
            }
            provisionJson(licenceCrmHandleNetlifyFormWebhook($input));

        case 'provision_vip':
            try {
                $result = licenceCrmProvisionVipFromForm($input);
                $result['submission_id'] = licenceCrmLogFormProvisionEvent(
                    'activation-torinvest',
                    $input,
                    $result,
                    null,
                    $isWebhook ? 'netlify_webhook' : 'browser'
                );
                if (!$isWebhook) {
                    torinvestRateLimitHit('license_provision');
                }
                provisionJson($result);
            } catch (Throwable $e) {
                licenceCrmLogFormProvisionEvent('activation-torinvest', $input, null, $e->getMessage(), $isWebhook ? 'netlify_webhook' : 'browser');
                throw $e;
            }

        case 'provision_accompagnement':
            try {
                $result = licenceCrmProvisionAccompagnementFromForm($input);
                $result['submission_id'] = licenceCrmLogFormProvisionEvent(
                    'activation-accompagnement-torinvest',
                    $input,
                    $result,
                    null,
                    $isWebhook ? 'netlify_webhook' : 'browser'
                );
                if (!$isWebhook) {
                    torinvestRateLimitHit('license_provision');
                }
                provisionJson($result);
            } catch (Throwable $e) {
                licenceCrmLogFormProvisionEvent('activation-accompagnement-torinvest', $input, null, $e->getMessage(), $isWebhook ? 'netlify_webhook' : 'browser');
                throw $e;
            }

        default:
            provisionJson(['ok' => false, 'error' => 'action_inconnue'], 400);
    }
} catch (InvalidArgumentException $e) {
    if (!$isWebhook) {
        torinvestRateLimitHit('license_provision');
    }
    provisionPublicError($e, $isWebhook);
} catch (RuntimeException $e) {
    provisionPublicError($e, $isWebhook);
} catch (Throwable $e) {
    provisionPublicError($e, $isWebhook);
}
