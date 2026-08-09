<?php
/**
 * API services KRM — verify, register_paid, submit_request, list, admin.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$allowedOrigins = [
    'https://www.torinvest-trading.com',
    'https://torinvest-trading.com',
    'https://torinvest-trading.netlify.app',
    'https://radar.torinvest-trading.com',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originHost = parse_url($origin, PHP_URL_HOST) ?? '';
$isNetlifyPreview = (bool) preg_match('/\.netlify\.app$/', (string) $originHost);
$originAllowed = ($origin === '') || in_array($origin, $allowedOrigins, true) || $isNetlifyPreview;

if (!$originAllowed) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Origin non autorisée']);
    exit;
}

if ($origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Méthode non autorisée']);
    exit;
}

require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/krm-service-payment-lib.php';

try {
    torinvestRateLimitGuard('krm_service_payment', 60, 60);
} catch (RuntimeException $e) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    exit;
}
torinvestRateLimitHit('krm_service_payment');

$body = file_get_contents('php://input');
$payload = json_decode($body ?: '', true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON invalide']);
    exit;
}

$action = (string) ($payload['action'] ?? 'verify');

try {
    if ($action === 'config') {
        echo json_encode([
            'ok' => true,
            'treasuryConfigured' => krmServicesTreasury() !== '',
            'mint' => KRM_MINT_OFFICIAL,
            'decimals' => KRM_DECIMALS,
            'services' => krmServicesCatalog(),
            'statuses' => krmServicesAllowedStatuses(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'verify') {
        echo json_encode(krmServicesVerifyPayment($payload, true), JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'register_paid') {
        $result = krmServicesRegisterPaid($payload);
        if (empty($result['ok'])) {
            http_response_code(400);
        }
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'submit_request') {
        $result = krmServicesSubmitRequest($payload);
        if (empty($result['ok'])) {
            http_response_code(400);
        }
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'list_my_requests') {
        $result = krmServicesListByWallet((string) ($payload['userWallet'] ?? ''));
        if (empty($result['ok'])) {
            http_response_code(400);
        }
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'admin_list') {
        $result = krmServicesAdminList((string) ($payload['pin'] ?? ''));
        if (empty($result['ok'])) {
            $err = (string) ($result['error'] ?? '');
            if ($err === 'UNAUTHORIZED') {
                http_response_code(401);
            } elseif ($err === 'PIN_NOT_CONFIGURED') {
                http_response_code(503);
            } else {
                http_response_code(400);
            }
        }
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'admin_list_purchases') {
        $limit = (int) ($payload['limit'] ?? 50);
        $result = krmServicesAdminListPurchases((string) ($payload['pin'] ?? ''), $limit);
        if (empty($result['ok'])) {
            $err = (string) ($result['error'] ?? '');
            if ($err === 'UNAUTHORIZED') {
                http_response_code(401);
            } elseif ($err === 'PIN_NOT_CONFIGURED') {
                http_response_code(503);
            } else {
                http_response_code(400);
            }
        }
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'admin_update_status') {
        $result = krmServicesAdminUpdateStatus($payload);
        if (empty($result['ok'])) {
            $err = (string) ($result['error'] ?? '');
            $code = 400;
            if ($err === 'UNAUTHORIZED') {
                $code = 401;
            } elseif ($err === 'PIN_NOT_CONFIGURED') {
                $code = 503;
            }
            http_response_code($code);
        }
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'UNKNOWN_ACTION']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
