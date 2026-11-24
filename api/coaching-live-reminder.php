<?php
/**
 * Envoi Brevo rappel live coaching — appelé par le VPS formation (job 4h / 1h).
 *
 * Auth : Header X-Formation-Provision-Key = formation_provision_secret
 * POST JSON : { email, date, start, end, label, hoursBefore, calendarUrl? }
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/formation-provision-lib.php';
require_once __DIR__ . '/brevo-lib.php';

function coachingLiveReminderJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    coachingLiveReminderJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$secret = formationProvisionSecret();
$headerKey = trim((string) ($_SERVER['HTTP_X_FORMATION_PROVISION_KEY'] ?? ''));
if ($secret === '' || $headerKey === '' || !hash_equals($secret, $headerKey)) {
    coachingLiveReminderJson(['ok' => false, 'error' => 'unauthorized'], 401);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '{}', true);
if (!is_array($input)) {
    coachingLiveReminderJson(['ok' => false, 'error' => 'invalid_json'], 400);
}

$email = strtolower(trim((string) ($input['email'] ?? '')));
$hoursBefore = (int) ($input['hoursBefore'] ?? 0);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    coachingLiveReminderJson(['ok' => false, 'error' => 'email_invalid'], 400);
}
if ($hoursBefore !== 1 && $hoursBefore !== 4) {
    coachingLiveReminderJson(['ok' => false, 'error' => 'hours_before_invalid'], 400);
}

try {
    $brevo = brevoSendCoachingLiveReminder([
        'email' => $email,
        'date' => (string) ($input['date'] ?? ''),
        'start' => (string) ($input['start'] ?? ''),
        'end' => (string) ($input['end'] ?? ''),
        'label' => (string) ($input['label'] ?? 'Live coaching'),
        'hoursBefore' => $hoursBefore,
        'calendarUrl' => (string) ($input['calendarUrl'] ?? 'https://app.torinvest-trading.com/calendar.html'),
        'sessionId' => (string) ($input['sessionId'] ?? ''),
    ]);
} catch (Throwable $e) {
    coachingLiveReminderJson([
        'ok' => false,
        'error' => $e->getMessage(),
    ], 500);
}

if (empty($brevo['ok'])) {
    coachingLiveReminderJson([
        'ok' => false,
        'error' => (string) ($brevo['error'] ?? $brevo['reason'] ?? 'brevo_failed'),
        'brevo' => $brevo,
        'email' => $email,
        'hoursBefore' => $hoursBefore,
    ], !empty($brevo['skipped']) ? 200 : 502);
}

coachingLiveReminderJson([
    'ok' => true,
    'email' => $email,
    'hoursBefore' => $hoursBefore,
    'brevo' => $brevo,
]);
