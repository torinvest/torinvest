<?php
/**
 * Discord TorPass — OAuth + attribution rôles selon solde KRM.
 * Réutilise la preuve wallet Fondamental (signMessage + Helius).
 * Ne touche pas au bot TradingView / macro existant.
 */
declare(strict_types=1);

require_once __DIR__ . '/fondamental-access-lib.php';
require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/torinvest-offers-lib.php';

function discordTorpassConfig(): array
{
    return fondaConfig();
}

function discordTorpassEnabled(): bool
{
    $cfg = discordTorpassConfig();
    if (empty($cfg['discord_torpass_enabled'])) {
        return false;
    }
    return discordTorpassBotToken() !== ''
        && discordTorpassClientId() !== ''
        && discordTorpassClientSecret() !== ''
        && discordTorpassGuildId() !== '';
}

function discordTorpassBotToken(): string
{
    return trim((string) (discordTorpassConfig()['discord_bot_token'] ?? ''));
}

function discordTorpassClientId(): string
{
    return trim((string) (discordTorpassConfig()['discord_client_id'] ?? ''));
}

function discordTorpassClientSecret(): string
{
    return trim((string) (discordTorpassConfig()['discord_client_secret'] ?? ''));
}

function discordTorpassGuildId(): string
{
    return trim((string) (discordTorpassConfig()['discord_guild_id'] ?? ''));
}

function discordTorpassRedirectUri(): string
{
    $cfg = discordTorpassConfig();
    $configured = trim((string) ($cfg['discord_oauth_redirect'] ?? ''));
    if ($configured !== '') {
        return $configured;
    }
    return 'https://radar.torinvest-trading.com/api/discord-torpass.php?action=callback';
}

function discordTorpassSuccessUrl(): string
{
    $cfg = discordTorpassConfig();
    $u = trim((string) ($cfg['discord_torpass_success_url'] ?? ''));
    return $u !== '' ? $u : 'https://www.torinvest-trading.com/torpass?discord=ok';
}

function discordTorpassErrorUrl(): string
{
    $cfg = discordTorpassConfig();
    $u = trim((string) ($cfg['discord_torpass_error_url'] ?? ''));
    return $u !== '' ? $u : 'https://www.torinvest-trading.com/torpass?discord=error';
}

function discordTorpassInviteUrl(): string
{
    $cfg = discordTorpassConfig();
    $u = trim((string) ($cfg['discord_public_url'] ?? ''));
    return $u !== '' ? $u : 'https://discord.gg/vwkPp2aeEM';
}

/** @return array{COMMUNITY:?string,ACADEMY:?string,PRO:?string} */
function discordTorpassRoleIds(): array
{
    $cfg = discordTorpassConfig();
    return [
        'COMMUNITY' => trim((string) ($cfg['discord_role_community'] ?? '')) ?: null,
        'ACADEMY' => trim((string) ($cfg['discord_role_academy'] ?? '')) ?: null,
        'PRO' => trim((string) ($cfg['discord_role_pro'] ?? '')) ?: null,
    ];
}

function discordTorpassHmacSecret(): string
{
    $cfg = discordTorpassConfig();
    $secret = trim((string) ($cfg['discord_torpass_hmac_secret'] ?? ''));
    if ($secret === '') {
        $secret = trim((string) ($cfg['member_hmac_secret'] ?? ''));
    }
    if ($secret === '') {
        $secret = aiAccessHmacSecret();
    }
    return $secret;
}

function discordTorpassDbPath(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    return $dir . '/discord-torpass.sqlite';
}

function discordTorpassPdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $pdo = new PDO('sqlite:' . discordTorpassDbPath());
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS discord_torpass_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet TEXT NOT NULL,
            discord_user_id TEXT NOT NULL,
            discord_username TEXT,
            krm REAL,
            level TEXT,
            roles_json TEXT,
            updated_at TEXT NOT NULL,
            UNIQUE(wallet),
            UNIQUE(discord_user_id)
        )'
    );
    return $pdo;
}

function discordTorpassLevelFromBalance(float $krm): string
{
    return torinvestOffersLevelFromBalance($krm);
}

/**
 * Rôles cumulatifs à assigner pour un niveau.
 * @return list<string> role IDs
 */
function discordTorpassRolesForLevel(string $level): array
{
    $ids = discordTorpassRoleIds();
    $rank = torinvestOffersLevelRank($level);
    $out = [];
    if ($rank >= 1 && !empty($ids['COMMUNITY'])) {
        $out[] = $ids['COMMUNITY'];
    }
    if ($rank >= 2 && !empty($ids['ACADEMY'])) {
        $out[] = $ids['ACADEMY'];
    }
    if ($rank >= 3 && !empty($ids['PRO'])) {
        $out[] = $ids['PRO'];
    }
    return array_values(array_unique($out));
}

function discordTorpassSignState(array $payload): string
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    $b64 = rtrim(strtr(base64_encode((string) $json), '+/', '-_'), '=');
    $sig = hash_hmac('sha256', $b64, discordTorpassHmacSecret());
    return $b64 . '.' . $sig;
}

function discordTorpassVerifyState(string $state): ?array
{
    $parts = explode('.', $state, 2);
    if (count($parts) !== 2) {
        return null;
    }
    [$b64, $sig] = $parts;
    $expected = hash_hmac('sha256', $b64, discordTorpassHmacSecret());
    if (!hash_equals($expected, $sig)) {
        return null;
    }
    $json = base64_decode(strtr($b64, '-_', '+/'), true);
    if ($json === false) {
        return null;
    }
    $data = json_decode($json, true);
    if (!is_array($data) || empty($data['exp']) || (int) $data['exp'] < time()) {
        return null;
    }
    return $data;
}

function discordTorpassCreateChallenge(string $wallet): array
{
    $wallet = trim($wallet);
    if ($wallet === '' || strlen($wallet) < 32) {
        throw new InvalidArgumentException('wallet_invalide');
    }
    $nonce = bin2hex(random_bytes(16));
    $issuedAt = gmdate('c');
    $message =
        "TORINVEST Discord TorPass\n" .
        'Wallet: ' . $wallet . "\n" .
        'Nonce: ' . $nonce . "\n" .
        'Issued: ' . $issuedAt . "\n" .
        "Action: link-discord-roles";

    $dir = __DIR__ . '/data/discord-torpass-nonces';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    $file = $dir . '/' . hash('sha256', $wallet) . '.json';
    file_put_contents($file, json_encode([
        'wallet' => $wallet,
        'nonce' => $nonce,
        'message' => $message,
        'exp' => time() + 300,
    ], JSON_UNESCAPED_UNICODE));

    return [
        'ok' => true,
        'wallet' => $wallet,
        'nonce' => $nonce,
        'message' => $message,
        'expiresIn' => 300,
        'enabled' => discordTorpassEnabled(),
        'inviteUrl' => discordTorpassInviteUrl(),
    ];
}

function discordTorpassConsumeChallenge(string $wallet, string $nonce, string $message): void
{
    $file = __DIR__ . '/data/discord-torpass-nonces/' . hash('sha256', trim($wallet)) . '.json';
    if (!is_file($file)) {
        throw new RuntimeException('challenge_expire');
    }
    $data = json_decode((string) file_get_contents($file), true);
    @unlink($file);
    if (!is_array($data) || (int) ($data['exp'] ?? 0) < time()) {
        throw new RuntimeException('challenge_expire');
    }
    if (!hash_equals((string) ($data['wallet'] ?? ''), trim($wallet))) {
        throw new RuntimeException('challenge_wallet_mismatch');
    }
    if (!hash_equals((string) ($data['nonce'] ?? ''), $nonce)) {
        throw new RuntimeException('challenge_nonce_mismatch');
    }
    if (!hash_equals((string) ($data['message'] ?? ''), $message)) {
        throw new RuntimeException('challenge_message_mismatch');
    }
}

function discordTorpassHttpJson(string $method, string $url, ?array $body, array $headers): array
{
    $ch = curl_init($url);
    $hdrs = array_merge(['Accept: application/json'], $headers);
    $opts = [
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $hdrs,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25,
    ];
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
        $hdrs[] = 'Content-Type: application/json';
        $opts[CURLOPT_HTTPHEADER] = $hdrs;
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($data)) {
        $data = ['raw' => is_string($raw) ? substr($raw, 0, 300) : null];
    }
    $data['_http'] = $code;
    return $data;
}

function discordTorpassStart(string $wallet, string $signatureBase64, string $message, string $nonce): array
{
    torinvestRateLimitGuard('discord_torpass_start', 12, 900);

    if (!discordTorpassEnabled()) {
        torinvestRateLimitHit('discord_torpass_start');
        throw new RuntimeException('discord_torpass_not_configured');
    }

    $wallet = trim($wallet);
    try {
        discordTorpassConsumeChallenge($wallet, $nonce, $message);
        if (!fondaVerifyWalletSignature($wallet, $message, $signatureBase64)) {
            throw new RuntimeException('signature_invalide');
        }
        $krm = fondaReadKrmBalance($wallet);
        $level = discordTorpassLevelFromBalance($krm);
        if (torinvestOffersLevelRank($level) < 1) {
            throw new RuntimeException('krm_insuffisant_community');
        }
        $roles = discordTorpassRolesForLevel($level);
        if ($roles === []) {
            throw new RuntimeException('roles_non_configures');
        }
    } catch (Throwable $e) {
        torinvestRateLimitHit('discord_torpass_start');
        throw $e;
    }

    $state = discordTorpassSignState([
        'wallet' => $wallet,
        'krm' => $krm,
        'level' => $level,
        'roles' => $roles,
        'exp' => time() + 600,
        'nonce' => bin2hex(random_bytes(8)),
    ]);

    $params = http_build_query([
        'client_id' => discordTorpassClientId(),
        'response_type' => 'code',
        'redirect_uri' => discordTorpassRedirectUri(),
        'scope' => 'identify guilds.join',
        'state' => $state,
        'prompt' => 'consent',
    ]);

    return [
        'ok' => true,
        'authorizeUrl' => 'https://discord.com/api/oauth2/authorize?' . $params,
        'level' => $level,
        'krm' => $krm,
        'inviteUrl' => discordTorpassInviteUrl(),
        'message' => 'Autorise Discord puis les rôles TorPass seront appliqués.',
    ];
}

function discordTorpassExchangeCode(string $code): array
{
    $ch = curl_init('https://discord.com/api/oauth2/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_POSTFIELDS => http_build_query([
            'client_id' => discordTorpassClientId(),
            'client_secret' => discordTorpassClientSecret(),
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => discordTorpassRedirectUri(),
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25,
    ]);
    $raw = curl_exec($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = is_string($raw) ? json_decode($raw, true) : null;
    if ($http >= 400 || !is_array($data) || empty($data['access_token'])) {
        throw new RuntimeException('oauth_token_failed');
    }
    return $data;
}

function discordTorpassFetchUser(string $accessToken): array
{
    $data = discordTorpassHttpJson('GET', 'https://discord.com/api/users/@me', null, [
        'Authorization: Bearer ' . $accessToken,
    ]);
    if (($data['_http'] ?? 500) >= 400 || empty($data['id'])) {
        throw new RuntimeException('discord_user_failed');
    }
    return $data;
}

/**
 * Ajoute le membre au serveur + rôles (guilds.join + Bot).
 */
function discordTorpassAddMemberWithRoles(string $discordUserId, string $accessToken, array $roleIds): array
{
    $guild = discordTorpassGuildId();
    $url = 'https://discord.com/api/guilds/' . rawurlencode($guild) . '/members/' . rawurlencode($discordUserId);
    $body = [
        'access_token' => $accessToken,
        'roles' => array_values($roleIds),
    ];
    $data = discordTorpassHttpJson('PUT', $url, $body, [
        'Authorization: Bot ' . discordTorpassBotToken(),
    ]);
    $http = (int) ($data['_http'] ?? 500);
    // 201 created, 204 already member updated
    if ($http !== 201 && $http !== 204 && $http !== 200) {
        // Fallback : membre déjà présent → assigner rôles un par un
        foreach ($roleIds as $roleId) {
            $roleUrl = $url . '/roles/' . rawurlencode($roleId);
            $r = discordTorpassHttpJson('PUT', $roleUrl, null, [
                'Authorization: Bot ' . discordTorpassBotToken(),
            ]);
            $rh = (int) ($r['_http'] ?? 500);
            if ($rh !== 204 && $rh !== 200 && $rh !== 201) {
                throw new RuntimeException('role_assign_failed:' . $roleId . ':' . $rh);
            }
        }
        return ['ok' => true, 'mode' => 'roles_only', 'http' => $http];
    }
    return ['ok' => true, 'mode' => 'member_put', 'http' => $http];
}

function discordTorpassSaveLink(string $wallet, array $discordUser, float $krm, string $level, array $roles): void
{
    $pdo = discordTorpassPdo();
    $username = (string) ($discordUser['username'] ?? '');
    if (!empty($discordUser['global_name'])) {
        $username = (string) $discordUser['global_name'] . ' (@' . $username . ')';
    }
    $stmt = $pdo->prepare(
        'INSERT INTO discord_torpass_links (wallet, discord_user_id, discord_username, krm, level, roles_json, updated_at)
         VALUES (:wallet, :uid, :uname, :krm, :level, :roles, :updated)
         ON CONFLICT(wallet) DO UPDATE SET
            discord_user_id = excluded.discord_user_id,
            discord_username = excluded.discord_username,
            krm = excluded.krm,
            level = excluded.level,
            roles_json = excluded.roles_json,
            updated_at = excluded.updated_at'
    );
    $stmt->execute([
        ':wallet' => $wallet,
        ':uid' => (string) $discordUser['id'],
        ':uname' => $username,
        ':krm' => $krm,
        ':level' => $level,
        ':roles' => json_encode($roles, JSON_UNESCAPED_UNICODE),
        ':updated' => gmdate('c'),
    ]);
}

function discordTorpassHandleCallback(string $code, string $state): array
{
    $payload = discordTorpassVerifyState($state);
    if ($payload === null) {
        throw new RuntimeException('state_invalide');
    }
    $wallet = (string) ($payload['wallet'] ?? '');
    $level = (string) ($payload['level'] ?? 'PUBLIC');
    $krm = (float) ($payload['krm'] ?? 0);
    $roles = is_array($payload['roles'] ?? null) ? $payload['roles'] : [];
    if ($wallet === '' || $roles === []) {
        throw new RuntimeException('state_incomplet');
    }

    // Re-check solde au moment du callback (évite state périmé)
    $liveKrm = fondaReadKrmBalance($wallet);
    $liveLevel = discordTorpassLevelFromBalance($liveKrm);
    if (torinvestOffersLevelRank($liveLevel) < 1) {
        throw new RuntimeException('krm_insuffisant_community');
    }
    $roles = discordTorpassRolesForLevel($liveLevel);
    if ($roles === []) {
        throw new RuntimeException('roles_non_configures');
    }

    $tokenData = discordTorpassExchangeCode($code);
    $accessToken = (string) $tokenData['access_token'];
    $user = discordTorpassFetchUser($accessToken);
    $assign = discordTorpassAddMemberWithRoles((string) $user['id'], $accessToken, $roles);
    discordTorpassSaveLink($wallet, $user, $liveKrm, $liveLevel, $roles);

    return [
        'ok' => true,
        'wallet' => $wallet,
        'level' => $liveLevel,
        'krm' => $liveKrm,
        'discordUserId' => (string) $user['id'],
        'assign' => $assign,
    ];
}

function discordTorpassStatus(): array
{
    return [
        'ok' => true,
        'enabled' => discordTorpassEnabled(),
        'inviteUrl' => discordTorpassInviteUrl(),
        'minKrmCommunity' => 100,
        'rolesConfigured' => array_keys(array_filter(discordTorpassRoleIds())),
        'note' => discordTorpassEnabled()
            ? 'OAuth Discord TorPass actif.'
            : 'Configure discord_torpass_enabled + bot/oauth/rôles dans config.local.php',
    ];
}
