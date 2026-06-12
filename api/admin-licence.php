<?php
/**
 * TORINVEST — API CRM licences (admin-licence).
 * Hébergement recommandé : radar.torinvest-trading.com/api/admin-licence.php
 */
declare(strict_types=1);

require_once __DIR__ . '/admin-licence-lib.php';
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

function licenceCrmJson(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function licenceCrmBearerToken(): string
{
    $cookie = torinvestSessionReadCookie('admin_licence');
    if ($cookie !== '') {
        return $cookie;
    }
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
        return '';
    }
    return trim($m[1]);
}

function licenceCrmRequireAuth(): void
{
    $pin = licenceCrmPin();
    if ($pin === '') {
        licenceCrmJson(['ok' => false, 'error' => 'licence_crm_pin non configuré'], 503);
    }
    $token = licenceCrmBearerToken();
    if ($token === '') {
        licenceCrmJson(['ok' => false, 'error' => 'unauthorized'], 401);
    }
    if (!licenceCrmVerifyToken($token, $pin)) {
        licenceCrmJson(['ok' => false, 'error' => 'session_expired'], 401);
    }
}

try {
    licenceCrmConfig();
} catch (Throwable $e) {
    licenceCrmJson(['ok' => false, 'error' => $e->getMessage()], 503);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    if ($action === 'export') {
        licenceCrmRequireAuth();
        $type = $_GET['type'] ?? null;
        if ($type !== null && $type !== '' && !in_array($type, ['VIP', 'FORGE'], true)) {
            $type = null;
        }
        $csv = licenceCrmExportCsv($type ?: null);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="torinvest-licences-' . date('Y-m-d-His') . '.csv"');
        echo "\xEF\xBB\xBF" . $csv;
        exit;
    }
    licenceCrmJson(['ok' => false, 'error' => 'action_inconnue'], 400);
}

if ($method !== 'POST') {
    licenceCrmJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    $input = [];
}
$action = (string) ($input['action'] ?? '');

try {
    if ($action === 'login') {
        $pin = licenceCrmPin();
        if ($pin === '') {
            licenceCrmJson(['ok' => false, 'error' => 'licence_crm_pin non configuré'], 503);
        }
        $submitted = trim((string) ($input['pin'] ?? ''));
        if ($submitted === '' || !hash_equals($pin, $submitted)) {
            licenceCrmJson(['ok' => false, 'error' => 'Code incorrect'], 401);
        }
        $expiresAt = time() + licenceCrmSessionTtl();
        $token = licenceCrmGenerateToken($expiresAt, $pin);
        torinvestSessionSetCookie('admin_licence', $token, $expiresAt);
        licenceCrmJson(['ok' => true, 'expiresAt' => $expiresAt]);
    }

    if ($action === 'logout') {
        torinvestSessionClearCookie('admin_licence');
        licenceCrmJson(['ok' => true]);
    }

    licenceCrmRequireAuth();

    switch ($action) {
        case 'list':
            $type = $input['type'] ?? null;
            if ($type !== null && $type !== '' && !in_array($type, ['VIP', 'FORGE'], true)) {
                $type = null;
            }
            $rows = licenceCrmListRecords($type ?: null, (int) ($input['limit'] ?? 200));
            licenceCrmJson(['ok' => true, 'count' => count($rows), 'records' => $rows]);

        case 'create_vip':
            licenceCrmJson(licenceCrmCreateVip($input));

        case 'activate_vip':
            licenceCrmJson(licenceCrmActivateVip($input));

        case 'create_forge':
            licenceCrmJson(licenceCrmCreateForge($input));

        case 'ping':
            licenceCrmJson([
                'ok' => true,
                'service' => 'TORINVEST admin-licence CRM',
                'worker' => licenceCrmWorkerUrl(),
            ]);

        default:
            licenceCrmJson(['ok' => false, 'error' => 'action_inconnue'], 400);
    }
} catch (InvalidArgumentException $e) {
    licenceCrmJson(['ok' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    licenceCrmJson(['ok' => false, 'error' => $e->getMessage()], 500);
}
