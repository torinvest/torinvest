<?php
/**
 * TORINVEST — Bibliothèque AI Access (sessions + proxy chat sécurisé).
 */
declare(strict_types=1);

require_once __DIR__ . '/http-session.php';

function aiAccessConfig(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $file = __DIR__ . '/config.local.php';
    if (!file_exists($file)) {
        throw new RuntimeException('Configuration manquante (config.local.php)');
    }
    $cfg = require $file;
    return is_array($cfg) ? $cfg : [];
}

function aiAccessWorkerUrl(): string
{
    $cfg = aiAccessConfig();
    return rtrim((string) ($cfg['worker_url'] ?? 'https://morning-hall-d8f6.onzerimes.workers.dev'), '/');
}

function aiAccessWorkerChatSecret(): string
{
    $cfg = aiAccessConfig();
    $secret = (string) ($cfg['ai_chat_secret'] ?? '');
    if ($secret === '') {
        $secret = (string) ($cfg['ai_decision_secret'] ?? '');
    }
    if ($secret === '') {
        throw new RuntimeException('ai_chat_secret manquant dans config.local.php (wrangler secret put AI_CHAT_SECRET)');
    }
    return $secret;
}

function aiAccessHmacSecret(): string
{
    $cfg = aiAccessConfig();
    $secret = (string) ($cfg['ai_access_hmac_secret'] ?? '');
    if ($secret === '') {
        $secret = (string) ($cfg['dev_access_pin'] ?? '') . '|' . (string) ($cfg['licence_crm_pin'] ?? '');
    }
    if ($secret === '|') {
        throw new RuntimeException('ai_access_hmac_secret ou PIN manquant dans config.local.php');
    }
    return $secret;
}

function aiAccessDevPin(): string
{
    $cfg = aiAccessConfig();
    return (string) ($cfg['dev_access_pin'] ?? '');
}

function aiAccessClientSessionTtl(): int
{
    $cfg = aiAccessConfig();
    return (int) ($cfg['ai_access_client_session_ttl'] ?? 43200);
}

function aiAccessAdminSessionTtl(): int
{
    $cfg = aiAccessConfig();
    return (int) ($cfg['ai_access_admin_session_ttl'] ?? ($cfg['dev_session_ttl'] ?? 604800));
}

function aiAccessChatRateLimitClient(): int
{
    $cfg = aiAccessConfig();
    return max(1, (int) ($cfg['ai_access_chat_rate_client'] ?? 80));
}

function aiAccessChatRateLimitAdmin(): int
{
    $cfg = aiAccessConfig();
    return max(1, (int) ($cfg['ai_access_chat_rate_admin'] ?? 300));
}

function aiAccessDbPath(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    return $dir . '/ai-access.sqlite';
}

function aiAccessPdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $pdo = new PDO('sqlite:' . aiAccessDbPath());
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ai_chat_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_ai_chat_usage_hash ON ai_chat_usage(session_hash, created_at)');
    return $pdo;
}

function aiAccessGenerateToken(int $expiresAt, string $role, array $meta, string $secret): string
{
    $payload = json_encode([
        'exp' => $expiresAt,
        'nonce' => bin2hex(random_bytes(12)),
        'role' => $role,
        'meta' => $meta,
    ], JSON_UNESCAPED_UNICODE);
    $b64 = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
    $sig = hash_hmac('sha256', $b64, $secret);
    return $b64 . '.' . $sig;
}

function aiAccessVerifyToken(string $token, string $secret): ?array
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
    if (!is_array($data) || empty($data['exp']) || ($data['exp'] ?? 0) <= time()) {
        return null;
    }
    $role = (string) ($data['role'] ?? '');
    if (!in_array($role, ['client', 'admin'], true)) {
        return null;
    }
    return [
        'role' => $role,
        'meta' => is_array($data['meta'] ?? null) ? $data['meta'] : [],
        'expiresAt' => (int) $data['exp'],
    ];
}

function aiAccessCopyToken(): string
{
    $cfg = aiAccessConfig();
    $token = trim((string) ($cfg['copy_token'] ?? ''));
    if ($token === '' || $token === 'default') {
        throw new RuntimeException('copy_token manquant dans config.local.php (wrangler secret put COPY_TOKEN)');
    }
    return $token;
}

function aiAccessWorkerGet(string $path, array $query = [], array $extraHeaders = []): array
{
    $url = aiAccessWorkerUrl() . $path;
    if ($query) {
        $url .= '?' . http_build_query($query);
    }
    $header = "Accept: application/json\r\n";
    foreach ($extraHeaders as $name => $value) {
        $v = trim((string) $value);
        if ($v !== '') {
            $header .= $name . ': ' . $v . "\r\n";
        }
    }
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => $header,
            'timeout' => 20,
            'ignore_errors' => true,
        ],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        throw new RuntimeException('Impossible de joindre le Worker Cloudflare');
    }
    $status = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int) $m[1];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new RuntimeException('Réponse Worker invalide (HTTP ' . $status . ')');
    }
    $data['_httpStatus'] = $status;
    return $data;
}

function aiAccessWorkerPostJson(string $path, array $body, ?string $bearerSecret = null): array
{
    $url = aiAccessWorkerUrl() . $path;
    $headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
    if ($bearerSecret !== null && $bearerSecret !== '') {
        $headers .= 'Authorization: Bearer ' . $bearerSecret . "\r\n";
    }
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => $headers,
            'content' => json_encode($body, JSON_UNESCAPED_UNICODE),
            'timeout' => 90,
            'ignore_errors' => true,
        ],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        throw new RuntimeException('Impossible de joindre le Worker /ai/chat');
    }
    $status = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int) $m[1];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new RuntimeException('Réponse /ai/chat invalide (HTTP ' . $status . ')');
    }
    $data['_httpStatus'] = $status;
    return $data;
}

function aiAccessValidateLicense(string $licenseKey, string $mt5Account = ''): array
{
    $query = ['key' => $licenseKey];
    if ($mt5Account !== '') {
        $query['account'] = $mt5Account;
    }
    $data = aiAccessWorkerGet('/validate-license', $query);
    if (empty($data['ok']) || ($data['canTrade'] ?? false) !== true) {
        $reason = (string) ($data['reason'] ?? $data['error'] ?? 'Licence invalide ou expirée');
        throw new RuntimeException($reason);
    }
    return $data;
}

function aiAccessCheckRateLimit(string $token, string $role): void
{
    $limit = $role === 'admin' ? aiAccessChatRateLimitAdmin() : aiAccessChatRateLimitClient();
    $hash = hash('sha256', $token);
    $pdo = aiAccessPdo();
    $since = time() - 3600;
    $pdo->prepare('DELETE FROM ai_chat_usage WHERE created_at < :since')->execute([':since' => $since]);
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM ai_chat_usage WHERE session_hash = :h AND created_at >= :since');
    $stmt->execute([':h' => $hash, ':since' => $since]);
    $count = (int) $stmt->fetchColumn();
    if ($count >= $limit) {
        throw new RuntimeException('Limite horaire AI Access atteinte (' . $limit . ' requêtes/h). Réessaie plus tard.');
    }
    $pdo->prepare('INSERT INTO ai_chat_usage (session_hash, created_at) VALUES (:h, :t)')
        ->execute([':h' => $hash, ':t' => time()]);
}

function aiAccessLoginClient(string $licenseKey, string $mt5Account = ''): array
{
    $licenseKey = trim($licenseKey);
    if ($licenseKey === '') {
        throw new InvalidArgumentException('Licence obligatoire');
    }
    $data = aiAccessValidateLicense($licenseKey, $mt5Account);
    $expiresAt = time() + aiAccessClientSessionTtl();
    $meta = [
        'licenseKey' => $licenseKey,
        'mt5Account' => $mt5Account,
        'email' => (string) ($data['email'] ?? ''),
        'plan' => (string) ($data['plan'] ?? ''),
        'status' => (string) ($data['status'] ?? ''),
        'expires' => (string) ($data['expires'] ?? ''),
    ];
    $token = aiAccessGenerateToken($expiresAt, 'client', $meta, aiAccessHmacSecret());
    torinvestSessionSetCookie('ai_access', $token, $expiresAt);
    return [
        'ok' => true,
        'role' => 'client',
        'expiresAt' => $expiresAt,
        'email' => $meta['email'],
        'plan' => $meta['plan'],
        'status' => $meta['status'],
        'licenseExpires' => $meta['expires'],
        'mt5Account' => $mt5Account !== '' ? $mt5Account : ($data['mt5Account'] ?? ''),
    ];
}

function aiAccessLoginAdmin(string $pin): array
{
    $expected = aiAccessDevPin();
    if ($expected === '' || !hash_equals($expected, trim($pin))) {
        throw new RuntimeException('Code admin incorrect');
    }
    $expiresAt = time() + aiAccessAdminSessionTtl();
    $token = aiAccessGenerateToken($expiresAt, 'admin', ['label' => 'admin'], aiAccessHmacSecret());
    torinvestSessionSetCookie('ai_access', $token, $expiresAt);
    return [
        'ok' => true,
        'role' => 'admin',
        'expiresAt' => $expiresAt,
        'label' => 'Administrateur TORINVEST',
    ];
}

function aiAccessPing(array $session): array
{
    if ($session['role'] === 'client') {
        $meta = $session['meta'];
        $licenseKey = (string) ($meta['licenseKey'] ?? '');
        $mt5 = (string) ($meta['mt5Account'] ?? '');
        if ($licenseKey === '') {
            throw new RuntimeException('Session licence invalide');
        }
        $data = aiAccessValidateLicense($licenseKey, $mt5);
        return [
            'ok' => true,
            'role' => 'client',
            'expiresAt' => $session['expiresAt'],
            'plan' => (string) ($data['plan'] ?? $meta['plan'] ?? ''),
            'status' => (string) ($data['status'] ?? $meta['status'] ?? ''),
            'licenseExpires' => (string) ($data['expires'] ?? $meta['expires'] ?? ''),
            'email' => (string) ($data['email'] ?? $meta['email'] ?? ''),
            'mt5Account' => (string) ($data['mt5Account'] ?? $mt5),
        ];
    }
    return [
        'ok' => true,
        'role' => 'admin',
        'expiresAt' => $session['expiresAt'],
        'label' => 'Administrateur TORINVEST',
    ];
}

function aiAccessRequireLicensedSession(array $session): void
{
    if ($session['role'] === 'client') {
        aiAccessValidateLicense(
            (string) ($session['meta']['licenseKey'] ?? ''),
            (string) ($session['meta']['mt5Account'] ?? '')
        );
        return;
    }
    if ($session['role'] !== 'admin') {
        throw new RuntimeException('Session non autorisée');
    }
}

function aiAccessWorkerHeadersForSession(array $session): array
{
    $headers = [];
    if ($session['role'] === 'client') {
        $licenseKey = trim((string) ($session['meta']['licenseKey'] ?? ''));
        if ($licenseKey !== '') {
            $headers['X-License'] = $licenseKey;
        }
    }
    return $headers;
}

function aiAccessProxyWorkerGet(array $session, string $path, array $query = []): array
{
    aiAccessRequireLicensedSession($session);
    $query['token'] = aiAccessCopyToken();
    $resp = aiAccessWorkerGet($path, $query, aiAccessWorkerHeadersForSession($session));
    $status = (int) ($resp['_httpStatus'] ?? 500);
    unset($resp['_httpStatus']);
    if ($status >= 400 || ($resp['ok'] ?? true) === false) {
        $err = (string) ($resp['error'] ?? $resp['message'] ?? 'Erreur Worker (HTTP ' . $status . ')');
        throw new RuntimeException($err);
    }
    return $resp;
}

function aiAccessProxyCopySignal(array $session, string $symbol): array
{
    $symbol = strtoupper(trim($symbol));
    if ($symbol === '') {
        $symbol = 'XAUUSD';
    }
    return aiAccessProxyWorkerGet($session, '/copy/signal', ['symbol' => $symbol]);
}

function aiAccessProxyAgentContext(array $session, string $symbol, string $mode): array
{
    $symbol = strtoupper(trim($symbol));
    if ($symbol === '') {
        $symbol = 'XAUUSD';
    }
    $mode = trim($mode);
    if ($mode === '') {
        $mode = 'scalping';
    }
    return aiAccessProxyWorkerGet($session, '/agent/context', [
        'symbol' => $symbol,
        'mode' => $mode,
    ]);
}

function aiAccessProxySystemHealth(array $session): array
{
    return aiAccessProxyWorkerGet($session, '/system/health', []);
}

function aiAccessProxyChat(array $session, array $input): array
{
    aiAccessCheckRateLimit((string) ($input['_token'] ?? ''), $session['role']);

    if ($session['role'] === 'client') {
        $meta = $session['meta'];
        aiAccessValidateLicense(
            (string) ($meta['licenseKey'] ?? ''),
            (string) ($meta['mt5Account'] ?? '')
        );
    }

    $model = trim((string) ($input['model'] ?? 'mistral-large-latest'));
    $messages = $input['messages'] ?? null;
    if (!is_array($messages) || !$messages) {
        throw new InvalidArgumentException('messages requis');
    }

    $body = [
        'model' => $model,
        'messages' => $messages,
        'temperature' => (float) ($input['temperature'] ?? 0.35),
        'max_tokens' => (int) ($input['max_tokens'] ?? 1800),
        'top_p' => (float) ($input['top_p'] ?? 0.95),
    ];

    $resp = aiAccessWorkerPostJson('/ai/chat', $body, aiAccessWorkerChatSecret());
    $status = (int) ($resp['_httpStatus'] ?? 500);
    if ($status >= 400 || !empty($resp['error'])) {
        $err = (string) ($resp['error'] ?? $resp['message'] ?? 'Erreur Worker /ai/chat');
        throw new RuntimeException($err);
    }
    unset($resp['_httpStatus']);
    return $resp;
}
