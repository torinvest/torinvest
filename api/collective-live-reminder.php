<?php
/**
 * Envoi Brevo rappel live collectif — appelé par le VPS formation (job 4h / 1h).
 *
 * Auth : Header X-Formation-Provision-Key
 * POST JSON : { date, start, end, label, hoursBefore, channel?, url?, calendarUrl? }
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/formation-provision-lib.php';
require_once __DIR__ . '/brevo-lib.php';

function collectiveLiveReminderJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    collectiveLiveReminderJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$secret = formationProvisionSecret();
$headerKey = trim((string) ($_SERVER['HTTP_X_FORMATION_PROVISION_KEY'] ?? ''));
if ($secret === '' || $headerKey === '' || !hash_equals($secret, $headerKey)) {
    collectiveLiveReminderJson(['ok' => false, 'error' => 'unauthorized'], 401);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '{}', true);
if (!is_array($input)) {
    collectiveLiveReminderJson(['ok' => false, 'error' => 'invalid_json'], 400);
}

$hoursBefore = (int) ($input['hoursBefore'] ?? 0);
if ($hoursBefore !== 1 && $hoursBefore !== 4) {
    collectiveLiveReminderJson(['ok' => false, 'error' => 'hours_before_invalid'], 400);
}

try {
    $brevo = brevoSendCollectiveLiveReminder([
        'date' => (string) ($input['date'] ?? ''),
        'start' => (string) ($input['start'] ?? ''),
        'end' => (string) ($input['end'] ?? ''),
        'label' => (string) ($input['label'] ?? 'Live collectif'),
        'hoursBefore' => $hoursBefore,
        'channel' => (string) ($input['channel'] ?? ''),
        'url' => (string) ($input['url'] ?? ''),
        'calendarUrl' => (string) ($input['calendarUrl'] ?? 'https://app.torinvest-trading.com/calendar.html'),
        'sessionId' => (string) ($input['sessionId'] ?? ''),
    ]);
} catch (Throwable $e) {
    collectiveLiveReminderJson([
        'ok' => false,
        'error' => $e->getMessage(),
    ], 500);
}

if (empty($brevo['ok'])) {
    collectiveLiveReminderJson([
        'ok' => false,
        'error' => (string) ($brevo['error'] ?? $brevo['reason'] ?? 'brevo_failed'),
        'brevo' => $brevo,
        'hoursBefore' => $hoursBefore,
    ], !empty($brevo['skipped']) ? 200 : 502);
}

collectiveLiveReminderJson([
    'ok' => true,
    'hoursBefore' => $hoursBefore,
    'brevo' => $brevo,
]);
