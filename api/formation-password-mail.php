<?php
/**
 * Envoi Brevo du mot de passe formation — appelé par le VPS app après provision.
 *
 * Auth : Header X-Formation-Provision-Key = formation_provision_secret (config.local.php)
 * POST JSON : { "email": "...", "password": "..." }
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/formation-provision-lib.php';

function formationPasswordMailJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    formationPasswordMailJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$secret = formationProvisionSecret();
$headerKey = trim((string) ($_SERVER['HTTP_X_FORMATION_PROVISION_KEY'] ?? ''));
if ($secret === '' || $headerKey === '' || !hash_equals($secret, $headerKey)) {
    formationPasswordMailJson(['ok' => false, 'error' => 'unauthorized'], 401);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '{}', true);
if (!is_array($input)) {
    formationPasswordMailJson(['ok' => false, 'error' => 'invalid_json'], 400);
}

$email = strtolower(trim((string) ($input['email'] ?? '')));
$password = trim((string) ($input['password'] ?? $input['formation_password'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    formationPasswordMailJson(['ok' => false, 'error' => 'email_invalid'], 400);
}
if ($password === '') {
    formationPasswordMailJson(['ok' => false, 'error' => 'password_missing'], 400);
}

$brevo = licenceCrmSendFormationPasswordBrevo($email, $password);
$logId = 0;
if (function_exists('licenceCrmLogFormationPassword')) {
    $logId = licenceCrmLogFormationPassword($email, $password, [
        'source' => 'formation_password_mail_api',
        'brevo_ok' => !empty($brevo['ok']),
        'brevo_error' => $brevo['error'] ?? null,
    ]);
}

if (empty($brevo['ok'])) {
    formationPasswordMailJson([
        'ok' => false,
        'error' => (string) ($brevo['error'] ?? 'brevo_failed'),
        'brevo' => $brevo,
        'password_log_id' => $logId ?: null,
        'email' => $email,
    ], 502);
}

formationPasswordMailJson([
    'ok' => true,
    'email' => $email,
    'brevo' => $brevo,
    'password_log_id' => $logId ?: null,
]);
