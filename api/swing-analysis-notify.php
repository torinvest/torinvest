<?php
/**
 * Notifie Discord + Brevo qu’une analyse swing est publiée.
 * Appelé par le VPS formation au clic « Publier » (si notify=true).
 *
 * Auth : Header X-Formation-Provision-Key = formation_provision_secret
 * POST JSON : { title, pair, timeframe, bias, thesis?, url? }
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/formation-provision-lib.php';
require_once __DIR__ . '/brevo-lib.php';

function swingNotifyJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    swingNotifyJson(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$secret = formationProvisionSecret();
$headerKey = trim((string) ($_SERVER['HTTP_X_FORMATION_PROVISION_KEY'] ?? ''));
if ($secret === '' || $headerKey === '' || !hash_equals($secret, $headerKey)) {
    swingNotifyJson(['ok' => false, 'error' => 'unauthorized'], 401);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '{}', true);
if (!is_array($input)) {
    swingNotifyJson(['ok' => false, 'error' => 'invalid_json'], 400);
}

$title = trim((string) ($input['title'] ?? ''));
if ($title === '') {
    swingNotifyJson(['ok' => false, 'error' => 'title_required'], 400);
}

$context = [
    'title' => $title,
    'pair' => trim((string) ($input['pair'] ?? 'XAUUSD')),
    'timeframe' => trim((string) ($input['timeframe'] ?? '')),
    'bias' => trim((string) ($input['bias'] ?? '')),
    'thesis' => trim((string) ($input['thesis'] ?? '')),
    'url' => trim((string) ($input['url'] ?? 'https://app.torinvest-trading.com/swing-analyses.html')),
];

$discord = swingAnalysisNotifyDiscord($context);
$brevo = brevoSendSwingAnalysisNotify($context);

$anySuccess = !empty($discord['ok']) || !empty($brevo['ok']);
$bothSkipped = !empty($discord['skipped']) && !empty($brevo['skipped']);

if ($bothSkipped) {
    swingNotifyJson([
        'ok' => false,
        'error' => 'no_channel_configured',
        'discord' => $discord,
        'brevo' => $brevo,
        'hint' => 'Configure swing_notify_discord_webhook (ou provision_notify_discord_webhook) et brevo_api_key + brevo_list_accompagnement',
    ], 503);
}

swingNotifyJson([
    'ok' => $anySuccess,
    'discord' => $discord,
    'brevo' => $brevo,
    'partial' => $anySuccess && (empty($discord['ok']) || empty($brevo['ok'])),
]);
