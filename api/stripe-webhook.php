<?php
/**
 * Webhook Stripe → provision licence + Brevo.
 *
 * URL : https://radar.torinvest-trading.com/api/stripe-webhook.php
 * Événement : checkout.session.completed
 */
declare(strict_types=1);

require_once __DIR__ . '/admin-licence-lib.php';
require_once __DIR__ . '/stripe-lib.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

function stripeWebhookRespond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    licenceCrmConfig();
} catch (Throwable $e) {
    stripeWebhookRespond(['ok' => false, 'error' => 'service_unavailable'], 503);
}

$payload = file_get_contents('php://input') ?: '';
$sigHeader = trim((string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? ''));

try {
    $secret = stripeWebhookSecret();
    if ($secret === '') {
        throw new RuntimeException('stripe_webhook_secret manquant');
    }

    $event = stripeVerifyWebhookPayload($payload, $sigHeader, $secret);
    $result = licenceCrmHandleStripeEvent($event);

    stripeWebhookRespond([
        'ok' => true,
        'received' => true,
        'event_id' => $event['id'] ?? null,
        'event_type' => $event['type'] ?? null,
        'result' => $result,
    ]);
} catch (InvalidArgumentException $e) {
    stripeWebhookRespond(['ok' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    stripeWebhookRespond(['ok' => false, 'error' => $e->getMessage()], 500);
} catch (Throwable $e) {
    stripeWebhookRespond(['ok' => false, 'error' => 'webhook_failed'], 500);
}
