<?php
/**
 * Rate limit IP simple (SQLite) — login PIN / tentatives auth.
 */
declare(strict_types=1);

function torinvestClientIp(): string
{
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (str_contains($ip, ',')) {
        $ip = trim(explode(',', $ip)[0]);
    }
    return $ip;
}

function torinvestRateLimitPdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    $pdo = new PDO('sqlite:' . $dir . '/rate-limit.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS rate_limit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL,
            ip TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_rl_scope_ip ON rate_limit(scope, ip, created_at)');
    return $pdo;
}

function torinvestRateLimitGuard(string $scope, int $maxAttempts = 8, int $windowSeconds = 900): void
{
    $ip = torinvestClientIp();
    $pdo = torinvestRateLimitPdo();
    $since = time() - $windowSeconds;
    $pdo->prepare('DELETE FROM rate_limit WHERE created_at < :since')->execute([':since' => $since]);
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM rate_limit WHERE scope = :scope AND ip = :ip AND created_at >= :since'
    );
    $stmt->execute([':scope' => $scope, ':ip' => $ip, ':since' => $since]);
    $count = (int) $stmt->fetchColumn();
    if ($count >= $maxAttempts) {
        throw new RuntimeException('Trop de tentatives. Réessaie dans 15 minutes.');
    }
}

function torinvestRateLimitHit(string $scope): void
{
    $ip = torinvestClientIp();
    $pdo = torinvestRateLimitPdo();
    $pdo->prepare('INSERT INTO rate_limit (scope, ip, created_at) VALUES (:scope, :ip, :t)')
        ->execute([':scope' => $scope, ':ip' => $ip, ':t' => time()]);
}