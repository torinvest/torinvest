<?php
/**
 * Cookies de session HttpOnly partagés (AI Access + admin-licence CRM).
 */
declare(strict_types=1);

function torinvestSessionCookieName(string $service): string
{
    if ($service === 'ai_access') {
        return 'torinvest_ai_access';
    }
    if ($service === 'admin_licence') {
        return 'torinvest_admin_licence';
    }
    throw new InvalidArgumentException('Service session inconnu');
}

function torinvestSessionIsSecure(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }
    return (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function torinvestSessionSetCookie(string $service, string $token, int $expiresAt): void
{
    setcookie(torinvestSessionCookieName($service), $token, [
        'expires' => $expiresAt,
        'path' => '/',
        'secure' => torinvestSessionIsSecure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function torinvestSessionClearCookie(string $service): void
{
    setcookie(torinvestSessionCookieName($service), '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => torinvestSessionIsSecure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function torinvestSessionReadCookie(string $service): string
{
    $name = torinvestSessionCookieName($service);
    return trim((string) ($_COOKIE[$name] ?? ''));
}
