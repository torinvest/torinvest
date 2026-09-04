<?php
/**
 * Trading Journal — accès Premium La Forge via bridge formation (HMAC).
 * Même secret que Fondamental / AI Access (ai_access_hmac_secret).
 */
declare(strict_types=1);

require_once __DIR__ . '/http-session.php';
require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/ai-access-lib.php';

final class JournalAccessException extends RuntimeException
{
    /** @param array<string, mixed> $payload */
    public function __construct(
        public array $payload,
        int $httpStatus = 403
    ) {
        parent::__construct((string) ($payload['error'] ?? 'error'), $httpStatus);
    }
}

function journalConfig(): array
{
    return aiAccessConfig();
}

function journalSessionTtl(): int
{
    $cfg = journalConfig();
    return (int) ($cfg['journal_access_session_ttl'] ?? $cfg['fondamental_access_session_ttl'] ?? 43200);
}

/** Répertoire app journal (hors DocumentRoot public, comme applifonda). */
function journalAppDir(): string
{
    $cfg = journalConfig();
    $configured = trim((string) ($cfg['journal_app_dir'] ?? ''));
    $candidates = array_values(array_filter([
        $configured !== '' ? $configured : null,
        '/var/lib/torinvest/appjournal',
        dirname(__DIR__) . '/private/appjournal',
        dirname(__DIR__) . '/appjournal',
    ]));
    foreach ($candidates as $dir) {
        $real = realpath($dir);
        if ($real !== false && is_dir($real)) {
            return $real;
        }
    }
    return $candidates[0] ?? (dirname(__DIR__) . '/appjournal');
}

function journalReadSession(): ?array
{
    try {
        $secret = aiAccessHmacSecret();
    } catch (Throwable $e) {
        return null;
    }
    $token = torinvestSessionReadCookie('journal_access');
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

function journalResolveSession(): ?array
{
    $session = journalReadSession();
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

function journalLoginFormationBridge(string $bridgeToken): array
{
    torinvestRateLimitGuard('journal_login_formation', 30, 60);
    $bridgeToken = trim($bridgeToken);
    if ($bridgeToken === '') {
        torinvestRateLimitHit('journal_login_formation');
        throw new InvalidArgumentException('bridgeToken requis');
    }

    $secret = aiAccessHmacSecret();
    $bridge = aiAccessVerifyToken($bridgeToken, $secret);
    if ($bridge === null) {
        torinvestRateLimitHit('journal_login_formation');
        throw new RuntimeException('Bridge formation invalide ou expiré');
    }

    $meta = is_array($bridge['meta'] ?? null) ? $bridge['meta'] : [];
    if (($meta['source'] ?? '') !== 'forge_formation' || trim((string) ($meta['email'] ?? '')) === '') {
        torinvestRateLimitHit('journal_login_formation');
        throw new RuntimeException('Bridge formation invalide');
    }

    $email = trim((string) $meta['email']);
    $expiresAt = time() + journalSessionTtl();
    $sessionMeta = [
        'source' => 'formation',
        'email' => $email,
        'level' => 'FORGE_PREMIUM',
        'app' => 'journal',
    ];
    $token = aiAccessGenerateToken($expiresAt, 'client', $sessionMeta, $secret);
    torinvestSessionSetCookie('journal_access', $token, $expiresAt);

    return [
        'ok' => true,
        'role' => 'client',
        'source' => 'formation',
        'email' => $email,
        'expiresAt' => $expiresAt,
        'sessionToken' => $token,
    ];
}

function journalPing(array $session): array
{
    return [
        'ok' => true,
        'role' => (string) ($session['role'] ?? 'client'),
        'expiresAt' => $session['expiresAt'] ?? null,
        'email' => $session['meta']['email'] ?? null,
        'source' => $session['meta']['source'] ?? null,
        'app' => 'journal',
    ];
}

function journalRequireSession(): array
{
    $session = journalResolveSession();
    if ($session === null) {
        throw new RuntimeException('unauthorized');
    }
    return $session;
}
