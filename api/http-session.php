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
    if ($service === 'accompagnement_access') {
        return 'torinvest_accompagnement';
    }
    throw new InvalidArgumentException('Service session inconnu');
}

function torinvestSessionIsSecure(): bool
{
    return true;
}

function torinvestSessionCookieOptions(int $expiresAt): array
{
    return [
        'expires' => $expiresAt,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        // www → radar = cross-site ; None requis pour credentials: include
        'samesite' => 'None',
    ];
}

function torinvestSessionSetCookie(string $service, string $token, int $expiresAt): void
{
    setcookie(torinvestSessionCookieName($service), $token, torinvestSessionCookieOptions($expiresAt));
}

function torinvestSessionClearCookie(string $service): void
{
    setcookie(torinvestSessionCookieName($service), '', torinvestSessionCookieOptions(time() - 3600));
}

function torinvestSessionReadCookie(string $service): string
{
    $name = torinvestSessionCookieName($service);
    return trim((string) ($_COOKIE[$name] ?? ''));
}
