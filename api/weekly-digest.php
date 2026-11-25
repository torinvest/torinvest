<?php
/**
 * Envoi Brevo bilan hebdomadaire La Forge — appelé le dimanche par le VPS formation.
 *
 * Auth : Header X-Formation-Provision-Key
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/formation-provision-lib.php';
require_once __DIR__ . '/brevo-lib.php';

function weeklyDigestJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    weeklyDigestJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$secret = formationProvisionSecret();
$headerKey = trim((string) ($_SERVER['HTTP_X_FORMATION_PROVISION_KEY'] ?? ''));
if ($secret === '' || $headerKey === '' || !hash_equals($secret, $headerKey)) {
    weeklyDigestJson(['ok' => false, 'error' => 'unauthorized'], 401);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '{}', true);
if (!is_array($input)) {
    weeklyDigestJson(['ok' => false, 'error' => 'invalid_json'], 400);
}

try {
    $brevo = brevoSendWeeklyDigest([
        'weekKey' => (string) ($input['weekKey'] ?? ''),
        'dateKey' => (string) ($input['dateKey'] ?? ''),
        'nextLive' => (string) ($input['nextLive'] ?? ''),
        'progress' => is_array($input['progress'] ?? null) ? $input['progress'] : [],
        'dashboardUrl' => (string) ($input['dashboardUrl'] ?? 'https://app.torinvest-trading.com/dashboard.html'),
        'cryptoUrl' => (string) ($input['cryptoUrl'] ?? 'https://app.torinvest-trading.com/crypto/index.html'),
        'journalUrl' => (string) ($input['journalUrl'] ?? 'https://app.torinvest-trading.com/journal.html'),
        'calendarUrl' => (string) ($input['calendarUrl'] ?? 'https://app.torinvest-trading.com/calendar.html'),
        'courseUrl' => (string) ($input['courseUrl'] ?? 'https://app.torinvest-trading.com/course/index.html'),
    ]);
} catch (Throwable $e) {
    weeklyDigestJson([
        'ok' => false,
        'error' => $e->getMessage(),
    ], 500);
}

if (empty($brevo['ok'])) {
    weeklyDigestJson([
        'ok' => false,
        'error' => (string) ($brevo['error'] ?? $brevo['reason'] ?? 'brevo_failed'),
        'brevo' => $brevo,
    ], !empty($brevo['skipped']) ? 200 : 502);
}

weeklyDigestJson([
    'ok' => true,
    'weekKey' => (string) ($input['weekKey'] ?? ''),
    'brevo' => $brevo,
]);
