<?php
/**
 * TORINVEST — Comptes membres du site (inscription / connexion).
 * Soft gate : session HttpOnly. Ne remplace pas les licences € ni TorPass KRM.
 */
declare(strict_types=1);

require_once __DIR__ . '/http-session.php';
require_once __DIR__ . '/rate-limit.php';

function memberAuthConfig(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $file = __DIR__ . '/config.local.php';
    if (!file_exists($file)) {
        throw new RuntimeException('Configuration manquante (config.local.php)');
    }
    $loaded = require $file;
    $cfg = is_array($loaded) ? $loaded : [];
    return $cfg;
}

function memberAuthHmacSecret(): string
{
    $cfg = memberAuthConfig();
    $secret = trim((string) ($cfg['member_hmac_secret'] ?? ''));
    if ($secret === '') {
        $secret = trim((string) ($cfg['ai_access_hmac_secret'] ?? ''));
    }
    if ($secret === '') {
        $secret = (string) ($cfg['dev_access_pin'] ?? '') . '|member|' . (string) ($cfg['licence_crm_pin'] ?? '');
    }
    if ($secret === '|member|' || strlen($secret) < 12) {
        throw new RuntimeException('member_hmac_secret manquant dans config.local.php');
    }
    return $secret;
}

function memberAuthSessionTtl(): int
{
    $cfg = memberAuthConfig();
    return max(3600, (int) ($cfg['member_session_ttl'] ?? 2592000)); // 30 jours
}

function memberAuthDbPath(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    return $dir . '/site-members.sqlite';
}

function memberAuthPdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $pdo = new PDO('sqlite:' . memberAuthDbPath());
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS site_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            created_at TEXT NOT NULL,
            last_login_at TEXT,
            status TEXT NOT NULL DEFAULT "active"
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_site_members_email ON site_members(email)');
    return $pdo;
}

function memberAuthNormalizeEmail(string $email): string
{
    return strtolower(trim($email));
}

function memberAuthGenerateToken(int $expiresAt, array $meta, string $secret): string
{
    $payload = json_encode([
        'exp' => $expiresAt,
        'nonce' => bin2hex(random_bytes(12)),
        'role' => 'member',
        'meta' => $meta,
    ], JSON_UNESCAPED_UNICODE);
    $b64 = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
    $sig = hash_hmac('sha256', $b64, $secret);
    return $b64 . '.' . $sig;
}

function memberAuthVerifyToken(string $token, string $secret): ?array
{
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2) {
        return null;
    }
    [$b64, $sig] = $parts;
    $expected = hash_hmac('sha256', $b64, $secret);
    if (!hash_equals($expected, $sig)) {
        return null;
    }
    $json = base64_decode(strtr($b64, '-_', '+/'), true);
    if ($json === false) {
        return null;
    }
    $data = json_decode($json, true);
    if (!is_array($data) || empty($data['exp']) || (int) $data['exp'] <= time()) {
        return null;
    }
    if (($data['role'] ?? '') !== 'member') {
        return null;
    }
    return [
        'role' => 'member',
        'meta' => is_array($data['meta'] ?? null) ? $data['meta'] : [],
        'expiresAt' => (int) $data['exp'],
    ];
}

function memberAuthPublicMember(array $row): array
{
    return [
        'id' => (int) ($row['id'] ?? 0),
        'email' => (string) ($row['email'] ?? ''),
        'displayName' => (string) ($row['display_name'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'lastLoginAt' => (string) ($row['last_login_at'] ?? ''),
        'status' => (string) ($row['status'] ?? 'active'),
    ];
}

function memberAuthIssueSession(array $row): array
{
    $expiresAt = time() + memberAuthSessionTtl();
    $meta = [
        'memberId' => (int) $row['id'],
        'email' => (string) $row['email'],
        'displayName' => (string) ($row['display_name'] ?? ''),
    ];
    $token = memberAuthGenerateToken($expiresAt, $meta, memberAuthHmacSecret());
    torinvestSessionSetCookie('member', $token, $expiresAt);
    return [
        'ok' => true,
        'member' => memberAuthPublicMember($row),
        'expiresAt' => $expiresAt,
    ];
}

function memberAuthRegister(string $email, string $password, string $displayName = ''): array
{
    torinvestRateLimitGuard('member_register', 8, 900);
    $email = memberAuthNormalizeEmail($email);
    $password = (string) $password;
    $displayName = trim($displayName);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        torinvestRateLimitHit('member_register');
        throw new InvalidArgumentException('email_invalide');
    }
    if (strlen($password) < 8) {
        torinvestRateLimitHit('member_register');
        throw new InvalidArgumentException('mot_de_passe_trop_court');
    }
    if (strlen($password) > 128) {
        torinvestRateLimitHit('member_register');
        throw new InvalidArgumentException('mot_de_passe_trop_long');
    }

    $pdo = memberAuthPdo();
    $exists = $pdo->prepare('SELECT id FROM site_members WHERE email = :email LIMIT 1');
    $exists->execute([':email' => $email]);
    if ($exists->fetchColumn()) {
        torinvestRateLimitHit('member_register');
        throw new RuntimeException('email_deja_inscrit');
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($hash === false) {
        throw new RuntimeException('hash_echec');
    }

    $now = gmdate('c');
    $stmt = $pdo->prepare(
        'INSERT INTO site_members (email, password_hash, display_name, created_at, last_login_at, status)
         VALUES (:email, :hash, :name, :created, :login, "active")'
    );
    $stmt->execute([
        ':email' => $email,
        ':hash' => $hash,
        ':name' => $displayName !== '' ? $displayName : null,
        ':created' => $now,
        ':login' => $now,
    ]);

    $id = (int) $pdo->lastInsertId();
    $row = [
        'id' => $id,
        'email' => $email,
        'display_name' => $displayName,
        'created_at' => $now,
        'status' => 'active',
    ];
    $session = memberAuthIssueSession($row);
    $session['created'] = true;
    $session['message'] = 'Compte membre créé.';
    return $session;
}

function memberAuthLogin(string $email, string $password): array
{
    torinvestRateLimitGuard('member_login', 12, 900);
    $email = memberAuthNormalizeEmail($email);
    $password = (string) $password;

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        torinvestRateLimitHit('member_login');
        throw new InvalidArgumentException('identifiants_invalides');
    }

    $pdo = memberAuthPdo();
    $stmt = $pdo->prepare('SELECT * FROM site_members WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || empty($row['password_hash']) || !password_verify($password, (string) $row['password_hash'])) {
        torinvestRateLimitHit('member_login');
        throw new RuntimeException('identifiants_incorrects');
    }
    if (strtolower((string) ($row['status'] ?? '')) !== 'active') {
        torinvestRateLimitHit('member_login');
        throw new RuntimeException('compte_inactif');
    }

    $pdo->prepare('UPDATE site_members SET last_login_at = :t WHERE id = :id')
        ->execute([':t' => gmdate('c'), ':id' => (int) $row['id']]);

    $session = memberAuthIssueSession($row);
    $session['message'] = 'Connexion réussie.';
    return $session;
}

function memberAuthCurrentSession(): ?array
{
    try {
        $secret = memberAuthHmacSecret();
    } catch (Throwable $e) {
        return null;
    }
    $token = torinvestSessionReadCookie('member');
    if ($token === '') {
        return null;
    }
    $session = memberAuthVerifyToken($token, $secret);
    if ($session === null) {
        return null;
    }
    $meta = $session['meta'];
    $memberId = (int) ($meta['memberId'] ?? 0);
    if ($memberId < 1) {
        return null;
    }
    $pdo = memberAuthPdo();
    $stmt = $pdo->prepare('SELECT * FROM site_members WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $memberId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || strtolower((string) ($row['status'] ?? '')) !== 'active') {
        return null;
    }
    return [
        'ok' => true,
        'member' => memberAuthPublicMember($row),
        'expiresAt' => $session['expiresAt'],
    ];
}

function memberAuthLogout(): array
{
    torinvestSessionClearCookie('member');
    return ['ok' => true, 'loggedOut' => true];
}

/** Admin CRM — liste membres site (sans mot de passe). */
function memberAuthAdminList(int $limit = 500, int $offset = 0): array
{
    $limit = max(1, min($limit, 2000));
    $offset = max(0, $offset);
    $pdo = memberAuthPdo();
    $total = (int) $pdo->query('SELECT COUNT(*) FROM site_members')->fetchColumn();
    $stmt = $pdo->prepare(
        'SELECT id, email, display_name, created_at, last_login_at, status
         FROM site_members
         ORDER BY created_at DESC
         LIMIT :limit OFFSET :offset'
    );
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $rows = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $rows[] = memberAuthPublicMember($row);
    }
    return [
        'ok' => true,
        'total' => $total,
        'count' => count($rows),
        'offset' => $offset,
        'members' => $rows,
    ];
}

function memberAuthAdminExportCsv(): string
{
    $pdo = memberAuthPdo();
    $stmt = $pdo->query(
        'SELECT id, email, display_name, created_at, last_login_at, status
         FROM site_members ORDER BY created_at DESC'
    );
    $lines = ['id,email,display_name,created_at,last_login_at,status'];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $cells = [
            (int) $row['id'],
            (string) $row['email'],
            (string) ($row['display_name'] ?? ''),
            (string) ($row['created_at'] ?? ''),
            (string) ($row['last_login_at'] ?? ''),
            (string) ($row['status'] ?? ''),
        ];
        $lines[] = implode(',', array_map(static function ($v) {
            $v = str_replace('"', '""', (string) $v);
            return '"' . $v . '"';
        }, $cells));
    }
    return implode("\n", $lines);
}

function memberAuthAdminSetStatus(int $memberId, string $status): array
{
    $status = strtolower(trim($status));
    if (!in_array($status, ['active', 'suspended'], true)) {
        throw new InvalidArgumentException('status_invalide');
    }
    if ($memberId < 1) {
        throw new InvalidArgumentException('id_invalide');
    }
    $pdo = memberAuthPdo();
    $stmt = $pdo->prepare('SELECT id, email, display_name, created_at, last_login_at, status FROM site_members WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $memberId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new RuntimeException('membre_introuvable');
    }
    $pdo->prepare('UPDATE site_members SET status = :status WHERE id = :id')
        ->execute([':status' => $status, ':id' => $memberId]);
    $row['status'] = $status;
    return [
        'ok' => true,
        'member' => memberAuthPublicMember($row),
    ];
}
