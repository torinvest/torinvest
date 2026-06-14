<?php
/**
 * TORINVEST — Client API Brevo (contacts + emails transactionnels).
 */
declare(strict_types=1);

require_once __DIR__ . '/admin-licence-lib.php';

function brevoConfigValue(string $key, mixed $default = null): mixed
{
    $cfg = licenceCrmConfig();
    return $cfg[$key] ?? $default;
}

function brevoApiKey(): string
{
    return trim((string) brevoConfigValue('brevo_api_key', ''));
}

function brevoIsConfigured(): bool
{
    return brevoApiKey() !== '';
}

function brevoListId(string $planKey): int
{
    $map = [
        'accompagnement' => (int) brevoConfigValue('brevo_list_accompagnement', 0),
        'vip' => (int) brevoConfigValue('brevo_list_vip', 0),
        'waitlist' => (int) brevoConfigValue('brevo_list_waitlist', 0),
    ];
    return (int) ($map[$planKey] ?? 0);
}

function brevoApiRequest(string $method, string $path, ?array $body = null): array
{
    $apiKey = brevoApiKey();
    if ($apiKey === '') {
        throw new RuntimeException('brevo_api_key manquant');
    }

    $url = 'https://api.brevo.com/v3' . $path;
    $headers = "Accept: application/json\r\napi-key: {$apiKey}\r\n";
    if ($body !== null) {
        $headers .= "Content-Type: application/json\r\n";
        $content = json_encode($body, JSON_UNESCAPED_UNICODE);
    } else {
        $content = '';
    }

    $ctx = stream_context_create([
        'http' => [
            'method' => strtoupper($method),
            'header' => $headers,
            'content' => $content,
            'timeout' => 20,
            'ignore_errors' => true,
        ],
    ]);

    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        throw new RuntimeException('Impossible de joindre Brevo');
    }

    $status = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int) $m[1];
    }

    $data = $raw !== '' ? json_decode($raw, true) : [];
    if (!is_array($data)) {
        $data = ['raw' => $raw];
    }
    $data['_httpStatus'] = $status;

    if ($status >= 400) {
        $msg = (string) ($data['message'] ?? $data['code'] ?? ('HTTP ' . $status));
        throw new RuntimeException('Brevo: ' . $msg);
    }

    return $data;
}

function brevoAddContactToList(
    string $email,
    int $listId,
    string $firstName = '',
    string $lastName = '',
    array $extraAttributes = []
): array {
    if ($listId < 1) {
        return ['skipped' => true, 'reason' => 'list_id_missing'];
    }

    $attributes = $extraAttributes;
    if ($firstName !== '') {
        $attributes['PRENOM'] = $firstName;
        $attributes['FIRSTNAME'] = $firstName;
    }
    if ($lastName !== '') {
        $attributes['NOM'] = $lastName;
        $attributes['LASTNAME'] = $lastName;
    }

    $payload = [
        'email' => strtolower(trim($email)),
        'updateEnabled' => true,
        'listIds' => [$listId],
    ];
    if ($attributes !== []) {
        $payload['attributes'] = $attributes;
    }

    return brevoApiRequest('POST', '/contacts', $payload);
}

function brevoSendLicenseEmail(string $planType, array $context): array
{
    $email = strtolower(trim((string) ($context['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email Brevo invalide');
    }

    $firstName = trim((string) ($context['first_name'] ?? ''));
    $license = trim((string) ($context['license'] ?? ''));
    $activationCode = trim((string) ($context['activation_code'] ?? ''));
    $links = is_array($context['access_links'] ?? null) ? $context['access_links'] : licenceCrmAccessLinks();

    $templateKey = $planType === 'ACCOMPAGNEMENT'
        ? 'brevo_template_accompagnement'
        : 'brevo_template_vip';
    $templateId = (int) brevoConfigValue($templateKey, 0);

    $senderEmail = trim((string) brevoConfigValue('brevo_sender_email', 'contact@torinvest-trading.com'));
    $senderName = trim((string) brevoConfigValue('brevo_sender_name', 'TORINVEST'));

    if ($templateId > 0) {
        return brevoApiRequest('POST', '/smtp/email', [
            'templateId' => $templateId,
            'to' => [['email' => $email, 'name' => trim($firstName . ' ' . ($context['last_name'] ?? '')) ?: $email]],
            'params' => [
                'PRENOM' => $firstName,
                'FIRSTNAME' => $firstName,
                'LICENCE' => $license,
                'LICENSE' => $license,
                'ACTIVATION_CODE' => $activationCode,
                'DISCORD_URL' => (string) ($links['discordPublic'] ?? $links['discordAccompagnement'] ?? ''),
                'TELEGRAM_URL' => (string) ($links['telegramPublic'] ?? $links['telegramVip'] ?? ''),
                'FORMATION_URL' => (string) ($links['appLoginUrl'] ?? ''),
                'ACTIVATION_URL' => $planType === 'ACCOMPAGNEMENT'
                    ? 'https://www.torinvest-trading.com/activation-accompagnement.html'
                    : 'https://www.torinvest-trading.com/activation.html',
            ],
        ]);
    }

    $productLabel = $planType === 'ACCOMPAGNEMENT' ? 'Accompagnement TORINVEST' : 'Robot Access VIP';
    $activationUrl = $planType === 'ACCOMPAGNEMENT'
        ? 'https://www.torinvest-trading.com/activation-accompagnement.html'
        : 'https://www.torinvest-trading.com/activation.html';

    $html = '<p>Bonjour' . ($firstName !== '' ? ' ' . htmlspecialchars($firstName, ENT_QUOTES, 'UTF-8') : '') . ',</p>';
    $html .= '<p>Merci pour votre achat <strong>' . htmlspecialchars($productLabel, ENT_QUOTES, 'UTF-8') . '</strong>.</p>';
    $html .= '<p><strong>Votre clé de licence :</strong><br><code style="font-size:16px;">' . htmlspecialchars($license, ENT_QUOTES, 'UTF-8') . '</code></p>';
    if ($activationCode !== '') {
        $html .= '<p><strong>Code d’activation MT5 :</strong><br><code>' . htmlspecialchars($activationCode, ENT_QUOTES, 'UTF-8') . '</code></p>';
    }
    $html .= '<p>Activez votre accès ici : <a href="' . htmlspecialchars($activationUrl, ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars($activationUrl, ENT_QUOTES, 'UTF-8') . '</a></p>';
    $html .= '<p>Utilisez le même email que celui utilisé pour le paiement Stripe.</p>';

    return brevoApiRequest('POST', '/smtp/email', [
        'sender' => ['name' => $senderName, 'email' => $senderEmail],
        'to' => [['email' => $email, 'name' => $firstName !== '' ? $firstName : $email]],
        'subject' => 'TORINVEST — Votre clé de licence',
        'htmlContent' => $html,
    ]);
}

function brevoSyncAfterProvision(string $planType, array $provisionResult): array
{
    if (!brevoIsConfigured()) {
        return ['brevo' => 'skipped', 'reason' => 'not_configured'];
    }

    $email = strtolower(trim((string) ($provisionResult['email'] ?? '')));
    if ($email === '') {
        return ['brevo' => 'skipped', 'reason' => 'email_missing'];
    }

    $planKey = $planType === 'ACCOMPAGNEMENT' ? 'accompagnement' : 'vip';
    $listId = brevoListId($planKey);
    $firstName = trim((string) ($provisionResult['first_name'] ?? ''));
    $lastName = trim((string) ($provisionResult['last_name'] ?? ''));

    $out = ['brevo' => []];
    try {
        $out['brevo']['contact'] = brevoAddContactToList($email, $listId, $firstName, $lastName, [
            'LICENCE' => (string) ($provisionResult['license'] ?? $provisionResult['code'] ?? ''),
            'PLAN' => $planType,
        ]);
    } catch (Throwable $e) {
        $out['brevo']['contact_error'] = $e->getMessage();
    }

    if (!empty($provisionResult['reused'])) {
        $out['brevo']['email'] = 'skipped_reused_license';
        return $out;
    }

    try {
        $out['brevo']['email'] = brevoSendLicenseEmail($planType, [
            'email' => $email,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'license' => (string) ($provisionResult['license'] ?? $provisionResult['code'] ?? ''),
            'activation_code' => (string) ($provisionResult['activationCode'] ?? ''),
            'access_links' => $provisionResult['accessLinks'] ?? licenceCrmAccessLinks(),
        ]);
    } catch (Throwable $e) {
        $out['brevo']['email_error'] = $e->getMessage();
    }

    return $out;
}
