<?php
/**
 * TORINVEST — Vérification signature webhooks Stripe (sans SDK).
 */
declare(strict_types=1);

function stripeWebhookSecret(): string
{
    require_once __DIR__ . '/admin-licence-lib.php';
    return trim((string) (licenceCrmConfig()['stripe_webhook_secret'] ?? ''));
}

function stripeVerifyWebhookPayload(string $payload, string $sigHeader, string $secret, int $toleranceSeconds = 300): array
{
    if ($secret === '') {
        throw new RuntimeException('stripe_webhook_secret manquant');
    }
    if ($payload === '') {
        throw new InvalidArgumentException('payload_vide');
    }
    if ($sigHeader === '') {
        throw new InvalidArgumentException('signature_stripe_absente');
    }

    $timestamp = null;
    $signatures = [];
    foreach (explode(',', $sigHeader) as $part) {
        [$k, $v] = array_map('trim', explode('=', $part, 2) + ['', '']);
        if ($k === 't') {
            $timestamp = (int) $v;
        } elseif ($k === 'v1' && $v !== '') {
            $signatures[] = $v;
        }
    }

    if ($timestamp === null || $signatures === []) {
        throw new InvalidArgumentException('signature_stripe_invalide');
    }

    if (abs(time() - $timestamp) > $toleranceSeconds) {
        throw new InvalidArgumentException('signature_stripe_expiree');
    }

    $signedPayload = $timestamp . '.' . $payload;
    $expected = hash_hmac('sha256', $signedPayload, $secret);
    $valid = false;
    foreach ($signatures as $sig) {
        if (hash_equals($expected, $sig)) {
            $valid = true;
            break;
        }
    }
    if (!$valid) {
        throw new InvalidArgumentException('signature_stripe_incorrecte');
    }

    $event = json_decode($payload, true);
    if (!is_array($event) || empty($event['type']) || empty($event['id'])) {
        throw new InvalidArgumentException('event_stripe_invalide');
    }

    return $event;
}
