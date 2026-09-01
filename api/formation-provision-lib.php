<?php
/**
 * TORINVEST — Provision compte formation La Forge (app) après accompagnement.
 * Indépendant des comptes membres site (member-auth / site-members.sqlite).
 */
declare(strict_types=1);

require_once __DIR__ . '/admin-licence-lib.php';

function formationProvisionConfig(): array
{
    return licenceCrmConfig();
}

function formationProvisionSecret(): string
{
    $cfg = formationProvisionConfig();
    return trim((string) ($cfg['formation_provision_secret'] ?? ''));
}

function formationProvisionUrl(): string
{
    $cfg = formationProvisionConfig();
    $url = trim((string) ($cfg['formation_provision_url'] ?? ''));
    if ($url === '') {
        $url = 'https://app.torinvest-trading.com/api/internal/formation-provision';
    }
    return $url;
}

/**
 * Crée ou met à jour un compte formation (email + mot de passe + subscribed).
 * Retourne ['ok'=>true, 'password'=>...] si généré, ou erreur silencieuse loggable.
 */
function formationProvisionAccompagnementUser(string $email, array $opts = []): array
{
    $email = strtolower(trim($email));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'email_invalid'];
    }

    $secret = formationProvisionSecret();
    if ($secret === '') {
        return ['ok' => false, 'error' => 'formation_provision_secret_missing', 'skipped' => true];
    }

    $body = [
        'email' => $email,
        'subscribed' => !empty($opts['subscribed']) || !isset($opts['subscribed']),
    ];
    if (!empty($opts['password'])) {
        $body['password'] = (string) $opts['password'];
    }

    $url = formationProvisionUrl();
    $headers = "Content-Type: application/json\r\nAccept: application/json\r\n"
        . 'X-Formation-Provision-Key: ' . $secret . "\r\n";

    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => $headers,
            'content' => json_encode($body, JSON_UNESCAPED_UNICODE),
            'timeout' => 25,
            'ignore_errors' => true,
        ],
    ]);

    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        return ['ok' => false, 'error' => 'formation_unreachable'];
    }

    $status = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int) $m[1];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return ['ok' => false, 'error' => 'formation_invalid_response', 'http' => $status];
    }

    if (empty($data['ok'])) {
        return [
            'ok' => false,
            'error' => (string) ($data['error'] ?? 'provision_failed'),
            'http' => $status,
        ];
    }

    $out = [
        'ok' => true,
        'email' => $email,
        'subscribed' => !empty($data['subscribed']),
        'generated' => !empty($data['generated']),
    ];
    if (!empty($data['password'])) {
        $out['password'] = (string) $data['password'];
    }
    return $out;
}
