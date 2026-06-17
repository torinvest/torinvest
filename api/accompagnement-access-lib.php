<?php
/**
 * TORINVEST — Sessions accès accompagnement (Crypto Radar + espace privé).
 */
declare(strict_types=1);

require_once __DIR__ . '/http-session.php';
require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/ai-access-lib.php';

function accompagnementAccessConfig(): array
{
    return aiAccessConfig();
}

function accompagnementAccessSessionTtl(): int
{
    $cfg = accompagnementAccessConfig();
    return (int) ($cfg['accompagnement_access_session_ttl'] ?? $cfg['ai_access_client_session_ttl'] ?? 43200);
}

function accompagnementAccessAdminSessionTtl(): int
{
    $cfg = accompagnementAccessConfig();
    return (int) ($cfg['accompagnement_access_admin_session_ttl'] ?? $cfg['ai_access_admin_session_ttl'] ?? 604800);
}

function accompagnementAccessIsAccompagnementPlan(string $plan): bool
{
    $plan = strtoupper(trim($plan));
    return $plan === 'ACCOMPAGNEMENT' || str_starts_with($plan, 'ACCOMP');
}

function accompagnementAccessValidateLicense(string $email, string $licenseKey): array
{
    $licenseKey = trim($licenseKey);
    $email = trim(strtolower($email));
    if ($licenseKey === '' || $email === '') {
        throw new InvalidArgumentException('Email et licence obligatoires');
    }

    $data = aiAccessWorkerGet('/validate-license', [
        'key' => $licenseKey,
        'email' => $email,
    ]);

    if (empty($data['ok'])) {
        $reason = (string) ($data['reason'] ?? $data['error'] ?? 'Licence invalide ou expirée');
        throw new RuntimeException($reason);
    }

    if (!accompagnementAccessIsAccompagnementPlan((string) ($data['plan'] ?? ''))) {
        throw new RuntimeException('Cette licence n\'est pas un accompagnement');
    }

    return $data;
}

function accompagnementAccessReadSession(): ?array
{
    try {
        $secret = aiAccessHmacSecret();
    } catch (Throwable $e) {
        return null;
    }

    $token = torinvestSessionReadCookie('accompagnement_access');
    if ($token === '') {
        return null;
    }

    $session = aiAccessVerifyToken($token, $secret);
    if ($session === null) {
        return null;
    }

    $session['token'] = $token;
    return $session;
}

function accompagnementAccessLoginClient(string $email, string $licenseKey): array
{
    torinvestRateLimitGuard('accompagnement_access_login_client');
    try {
        $data = accompagnementAccessValidateLicense($email, $licenseKey);
    } catch (Throwable $e) {
        torinvestRateLimitHit('accompagnement_access_login_client');
        throw $e;
    }

    $expiresAt = time() + accompagnementAccessSessionTtl();
    $meta = [
        'email' => trim(strtolower($email)),
        'licenseKey' => trim($licenseKey),
        'plan' => (string) ($data['plan'] ?? 'ACCOMPAGNEMENT'),
        'status' => (string) ($data['status'] ?? ''),
        'expires' => (string) ($data['expires'] ?? ''),
    ];
    $token = aiAccessGenerateToken($expiresAt, 'client', $meta, aiAccessHmacSecret());
    torinvestSessionSetCookie('accompagnement_access', $token, $expiresAt);

    return [
        'ok' => true,
        'role' => 'client',
        'expiresAt' => $expiresAt,
        'email' => $meta['email'],
        'plan' => $meta['plan'],
        'status' => $meta['status'],
        'licenseExpires' => $meta['expires'],
    ];
}

function accompagnementAccessLoginAdmin(string $pin): array
{
    torinvestRateLimitGuard('accompagnement_access_login_admin');
    $expected = aiAccessDevPin();
    if ($expected === '' || !hash_equals($expected, trim($pin))) {
        torinvestRateLimitHit('accompagnement_access_login_admin');
        throw new RuntimeException('Code admin incorrect');
    }

    $expiresAt = time() + accompagnementAccessAdminSessionTtl();
    $token = aiAccessGenerateToken($expiresAt, 'admin', ['label' => 'admin'], aiAccessHmacSecret());
    torinvestSessionSetCookie('accompagnement_access', $token, $expiresAt);

    return [
        'ok' => true,
        'role' => 'admin',
        'expiresAt' => $expiresAt,
        'label' => 'Administrateur TORINVEST',
    ];
}

function accompagnementAccessPing(array $session): array
{
    if ($session['role'] === 'admin') {
        return [
            'ok' => true,
            'role' => 'admin',
            'expiresAt' => $session['expiresAt'],
            'label' => 'Administrateur TORINVEST',
        ];
    }

    $meta = $session['meta'];
    $email = (string) ($meta['email'] ?? '');
    $licenseKey = (string) ($meta['licenseKey'] ?? '');
    if ($email === '' || $licenseKey === '') {
        throw new RuntimeException('Session licence invalide');
    }

    $data = accompagnementAccessValidateLicense($email, $licenseKey);
    return [
        'ok' => true,
        'role' => 'client',
        'expiresAt' => $session['expiresAt'],
        'plan' => (string) ($data['plan'] ?? $meta['plan'] ?? ''),
        'status' => (string) ($data['status'] ?? $meta['status'] ?? ''),
        'licenseExpires' => (string) ($data['expires'] ?? $meta['expires'] ?? ''),
        'email' => (string) ($data['email'] ?? $email),
    ];
}

function cryptoRadarIsAjaxRequest(): bool
{
    $accept = strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? ''));
    if (str_contains($accept, 'application/json')) {
        return true;
    }
    $requestedWith = strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? ''));
    return $requestedWith === 'xmlhttprequest';
}

function cryptoRadarLoginUrl(): string
{
    $return = 'https://' . ($_SERVER['HTTP_HOST'] ?? 'radar.torinvest-trading.com') . ($_SERVER['REQUEST_URI'] ?? '/crypto-radar/');
    return 'https://www.torinvest-trading.com/accompagnement-access.html?return=' . rawurlencode($return);
}

function cryptoRadarEnforceAccompagnementGate(): void
{
    if (PHP_SAPI === 'cli' || defined('CRYPTO_RADAR_SKIP_GATE')) {
        return;
    }

    try {
        accompagnementAccessConfig();
    } catch (Throwable $e) {
        cryptoRadarAccessDenied('service_unavailable');
        return;
    }

    $session = accompagnementAccessReadSession();
    if ($session === null) {
        cryptoRadarAccessDenied('unauthorized');
        return;
    }

    if ($session['role'] === 'admin') {
        return;
    }

    try {
        accompagnementAccessPing($session);
    } catch (Throwable $e) {
        torinvestSessionClearCookie('accompagnement_access');
        cryptoRadarAccessDenied('session_expired');
    }
}

function cryptoRadarAccessDenied(string $reason): void
{
    if (cryptoRadarIsAjaxRequest()) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok' => false,
            'error' => $reason,
            'login' => cryptoRadarLoginUrl(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Location: ' . cryptoRadarLoginUrl());
    exit;
}
