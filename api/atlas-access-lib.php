<?php
/**
 * USA War Atlas — accès Premium La Forge via bridge formation (HMAC).
 * Même secret que Fondamental / Journal / AI Access (ai_access_hmac_secret).
 */
declare(strict_types=1);

require_once __DIR__ . '/http-session.php';
require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/ai-access-lib.php';

final class AtlasAccessException extends RuntimeException
{
    /** @param array<string, mixed> $payload */
    public function __construct(
        public array $payload,
        int $httpStatus = 403
    ) {
        parent::__construct((string) ($payload['error'] ?? 'error'), $httpStatus);
    }
}

function atlasConfig(): array
{
    return aiAccessConfig();
}

function atlasSessionTtl(): int
{
    $cfg = atlasConfig();
    return (int) ($cfg['atlas_access_session_ttl'] ?? $cfg['journal_access_session_ttl'] ?? $cfg['fondamental_access_session_ttl'] ?? 43200);
}

/** Répertoire build SPA Atlas (hors DocumentRoot public, comme applifonda). */
function atlasAppDir(): string
{
    $cfg = atlasConfig();
    $configured = trim((string) ($cfg['atlas_app_dir'] ?? ''));
    $candidates = array_values(array_filter([
        $configured !== '' ? $configured : null,
        '/var/lib/torinvest/appliatlas',
        dirname(__DIR__) . '/private/appliatlas-dist',
        dirname(__DIR__) . '/appliatlas',
    ]));
    foreach ($candidates as $dir) {
        $real = realpath($dir);
        if ($real !== false && is_dir($real)) {
            return $real;
        }
    }
    return $candidates[0] ?? (dirname(__DIR__) . '/appliatlas');
}

function atlasReadSession(): ?array
{
    try {
        $secret = aiAccessHmacSecret();
    } catch (Throwable $e) {
        return null;
    }
    $token = torinvestSessionReadCookie('atlas_access');
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

function atlasResolveSession(): ?array
{
    $session = atlasReadSession();
    if ($session !== null) {
        return $session;
    }

    $token = trim((string) ($_GET['access_token'] ?? ''));
    if ($token === '') {
        return null;
    }

    try {
        $secret = aiAccessHmacSecret();
        $session = aiAccessVerifyToken($token, $secret);
        if ($session === null) {
            return null;
        }
        $session['token'] = $token;
        return $session;
    } catch (Throwable $e) {
        return null;
    }
}

function atlasLoginFormationBridge(string $bridgeToken): array
{
    torinvestRateLimitGuard('atlas_login_formation', 30, 60);
    $bridgeToken = trim($bridgeToken);
    if ($bridgeToken === '') {
        torinvestRateLimitHit('atlas_login_formation');
        throw new InvalidArgumentException('bridgeToken requis');
    }

    $secret = aiAccessHmacSecret();
    $bridge = aiAccessVerifyToken($bridgeToken, $secret);
    if ($bridge === null) {
        torinvestRateLimitHit('atlas_login_formation');
        throw new RuntimeException('Bridge formation invalide ou expiré');
    }

    $meta = is_array($bridge['meta'] ?? null) ? $bridge['meta'] : [];
    if (($meta['source'] ?? '') !== 'forge_formation' || trim((string) ($meta['email'] ?? '')) === '') {
        torinvestRateLimitHit('atlas_login_formation');
        throw new RuntimeException('Bridge formation invalide');
    }

    $email = trim((string) $meta['email']);
    $expiresAt = time() + atlasSessionTtl();
    $sessionMeta = [
        'source' => 'formation',
        'email' => $email,
        'level' => 'FORGE_PREMIUM',
        'app' => 'atlas',
    ];
    $token = aiAccessGenerateToken($expiresAt, 'client', $sessionMeta, $secret);
    torinvestSessionSetCookie('atlas_access', $token, $expiresAt);

    return [
        'ok' => true,
        'role' => 'client',
        'source' => 'formation',
        'email' => $email,
        'expiresAt' => $expiresAt,
        'sessionToken' => $token,
    ];
}

function atlasPing(array $session): array
{
    return [
        'ok' => true,
        'role' => (string) ($session['role'] ?? 'client'),
        'expiresAt' => $session['expiresAt'] ?? null,
        'email' => $session['meta']['email'] ?? null,
        'source' => $session['meta']['source'] ?? null,
        'app' => 'atlas',
    ];
}

function atlasRequireSession(): array
{
    $session = atlasResolveSession();
    if ($session === null) {
        throw new RuntimeException('unauthorized');
    }
    return $session;
}
