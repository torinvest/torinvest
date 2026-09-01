<?php
/**
 * Fondamental — accès TorPass ACADEMY (≥ 250 KRM) via session serveur.
 * Preuve wallet (signMessage Phantom) + solde vérifié on-chain (Helius).
 */
declare(strict_types=1);

require_once __DIR__ . '/http-session.php';
require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/ai-access-lib.php';

const FONDA_KRM_MINT = 'Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA';
const FONDA_MIN_KRM_DEFAULT = 250.0;

final class FondaAccessException extends RuntimeException
{
    /** @param array<string, mixed> $payload */
    public function __construct(
        public array $payload,
        int $httpStatus = 403
    ) {
        parent::__construct((string) ($payload['error'] ?? 'error'), $httpStatus);
    }
}

function fondaConfig(): array
{
    return aiAccessConfig();
}

function fondaMinKrm(): float
{
    $cfg = fondaConfig();
    $n = (float) ($cfg['fondamental_min_krm'] ?? FONDA_MIN_KRM_DEFAULT);
    return $n > 0 ? $n : FONDA_MIN_KRM_DEFAULT;
}

function fondaSessionTtl(): int
{
    $cfg = fondaConfig();
    return (int) ($cfg['fondamental_access_session_ttl'] ?? 43200);
}

/** Répertoire des fichiers applifonda (idéalement hors DocumentRoot). */
function fondaAppDir(): string
{
    $cfg = fondaConfig();
    $configured = trim((string) ($cfg['fondamental_app_dir'] ?? ''));
    $candidates = array_values(array_filter([
        $configured !== '' ? $configured : null,
        '/var/lib/torinvest/applifonda',
        dirname(__DIR__) . '/private/applifonda',
        dirname(__DIR__) . '/applifonda',
    ]));
    foreach ($candidates as $dir) {
        $real = realpath($dir);
        if ($real !== false && is_dir($real)) {
            return $real;
        }
    }
    return $candidates[0] ?? (dirname(__DIR__) . '/applifonda');
}

function fondaNonceDir(): string
{
    $dir = __DIR__ . '/data/fondamental-nonces';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

/** Base58 decode (Bitcoin/Solana alphabet). */
function fondaBase58Decode(string $input): string
{
    $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    $map = array_flip(str_split($alphabet));
    $bytes = [0];
    $len = strlen($input);
    for ($i = 0; $i < $len; $i++) {
        $ch = $input[$i];
        if (!isset($map[$ch])) {
            throw new InvalidArgumentException('Base58 invalide');
        }
        $carry = $map[$ch];
        for ($j = 0, $bj = count($bytes); $j < $bj; $j++) {
            $carry += $bytes[$j] * 58;
            $bytes[$j] = $carry & 0xff;
            $carry >>= 8;
        }
        while ($carry > 0) {
            $bytes[] = $carry & 0xff;
            $carry >>= 8;
        }
    }
    for ($i = 0; $i < $len && $input[$i] === '1'; $i++) {
        $bytes[] = 0;
    }
    return implode('', array_map('chr', array_reverse($bytes)));
}

function fondaHeliusRpc(array $payload): array
{
    $cfg = fondaConfig();
    $apiKey = (string) ($cfg['helius_api_key'] ?? '');
    if ($apiKey === '' || $apiKey === 'VOTRE_CLE_HELIUS_ICI') {
        throw new RuntimeException('Clé Helius non configurée');
    }
    $url = 'https://mainnet.helius-rpc.com/?api-key=' . rawurlencode($apiKey);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
    ]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false || $code >= 400) {
        throw new RuntimeException('RPC Solana indisponible');
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new RuntimeException('Réponse RPC invalide');
    }
    if (isset($data['error'])) {
        throw new RuntimeException('Erreur RPC: ' . json_encode($data['error']));
    }
    return $data;
}

function fondaReadKrmBalance(string $wallet): float
{
    $wallet = trim($wallet);
    if ($wallet === '') {
        return 0.0;
    }
    $resp = fondaHeliusRpc([
        'jsonrpc' => '2.0',
        'id' => 1,
        'method' => 'getTokenAccountsByOwner',
        'params' => [
            $wallet,
            ['mint' => FONDA_KRM_MINT],
            ['encoding' => 'jsonParsed'],
        ],
    ]);
    $values = $resp['result']['value'] ?? [];
    if (!is_array($values) || $values === []) {
        return 0.0;
    }
    $total = 0.0;
    foreach ($values as $row) {
        $amount = $row['account']['data']['parsed']['info']['tokenAmount'] ?? null;
        if (!is_array($amount)) {
            continue;
        }
        if (isset($amount['uiAmountString'])) {
            $total += (float) $amount['uiAmountString'];
        } elseif (isset($amount['uiAmount'])) {
            $total += (float) $amount['uiAmount'];
        }
    }
    return $total;
}

function fondaVerifyWalletSignature(string $walletBase58, string $message, string $signatureBase64): bool
{
    if (!function_exists('sodium_crypto_sign_verify_detached')) {
        throw new RuntimeException('Extension sodium PHP requise');
    }
    $pk = fondaBase58Decode($walletBase58);
    if (strlen($pk) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) {
        return false;
    }
    $sig = base64_decode($signatureBase64, true);
    if ($sig === false || strlen($sig) !== SODIUM_CRYPTO_SIGN_BYTES) {
        return false;
    }
    return sodium_crypto_sign_verify_detached($sig, $message, $pk);
}

function fondaCreateChallenge(string $wallet): array
{
    $wallet = trim($wallet);
    if ($wallet === '' || strlen($wallet) < 32) {
        throw new InvalidArgumentException('Wallet invalide');
    }
    $nonce = bin2hex(random_bytes(16));
    $issuedAt = gmdate('c');
    $message =
        "TORINVEST Fondamental Access\n" .
        'Wallet: ' . $wallet . "\n" .
        'Nonce: ' . $nonce . "\n" .
        'Issued: ' . $issuedAt . "\n" .
        'MinKRM: ' . fondaMinKrm();

    $file = fondaNonceDir() . '/' . hash('sha256', $wallet) . '.json';
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
        'minKrm' => fondaMinKrm(),
        'expiresIn' => 300,
    ];
}

function fondaConsumeChallenge(string $wallet, string $nonce, string $message): void
{
    $file = fondaNonceDir() . '/' . hash('sha256', trim($wallet)) . '.json';
    if (!is_file($file)) {
        throw new RuntimeException('Challenge expiré — recommence');
    }
    $data = json_decode((string) file_get_contents($file), true);
    @unlink($file);
    if (!is_array($data)) {
        throw new RuntimeException('Challenge invalide');
    }
    if ((int) ($data['exp'] ?? 0) < time()) {
        throw new RuntimeException('Challenge expiré — recommence');
    }
    if (!hash_equals((string) ($data['wallet'] ?? ''), trim($wallet))) {
        throw new RuntimeException('Wallet challenge mismatch');
    }
    if (!hash_equals((string) ($data['nonce'] ?? ''), $nonce)) {
        throw new RuntimeException('Nonce invalide');
    }
    if (!hash_equals((string) ($data['message'] ?? ''), $message)) {
        throw new RuntimeException('Message challenge mismatch');
    }
}

function fondaReadSession(): ?array
{
    try {
        $secret = aiAccessHmacSecret();
    } catch (Throwable $e) {
        return null;
    }
    $token = torinvestSessionReadCookie('fondamental_access');
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

/** Cookie navigateur ou access_token (proxy La Forge embed). */
function fondaResolveSession(): ?array
{
    $session = fondaReadSession();
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

function fondaLoginWallet(string $wallet, string $signatureBase64, string $message, string $nonce): array
{
    torinvestRateLimitGuard('fondamental_login', 20, 60);
    $wallet = trim($wallet);
    if ($wallet === '' || $signatureBase64 === '' || $message === '' || $nonce === '') {
        torinvestRateLimitHit('fondamental_login');
        throw new InvalidArgumentException('Paramètres login incomplets');
    }

    try {
        fondaConsumeChallenge($wallet, $nonce, $message);
        if (!fondaVerifyWalletSignature($wallet, $message, $signatureBase64)) {
            throw new RuntimeException('Signature wallet invalide');
        }
        $bal = fondaReadKrmBalance($wallet);
        $min = fondaMinKrm();
        if ($bal + 1e-9 < $min) {
            throw new FondaAccessException([
                'ok' => false,
                'code' => 'INSUFFICIENT_KRM',
                'error' => 'Solde KRM insuffisant — niveau TorPass ACADEMY requis',
                'wallet' => $wallet,
                'krm' => $bal,
                'minKrm' => $min,
            ], 403);
        }
    } catch (Throwable $e) {
        torinvestRateLimitHit('fondamental_login');
        throw $e;
    }

    $expiresAt = time() + fondaSessionTtl();
    $meta = [
        'wallet' => $wallet,
        'krm' => $bal,
        'minKrm' => $min,
        'level' => 'ACADEMY',
    ];
    $token = aiAccessGenerateToken($expiresAt, 'client', $meta, aiAccessHmacSecret());
    torinvestSessionSetCookie('fondamental_access', $token, $expiresAt);

    return [
        'ok' => true,
        'role' => 'client',
        'wallet' => $wallet,
        'krm' => $bal,
        'minKrm' => $min,
        'expiresAt' => $expiresAt,
    ];
}

function fondaLoginFormationBridge(string $bridgeToken): array
{
    torinvestRateLimitGuard('fondamental_login_formation', 30, 60);
    $bridgeToken = trim($bridgeToken);
    if ($bridgeToken === '') {
        torinvestRateLimitHit('fondamental_login_formation');
        throw new InvalidArgumentException('bridgeToken requis');
    }

    $secret = aiAccessHmacSecret();
    $bridge = aiAccessVerifyToken($bridgeToken, $secret);
    if ($bridge === null) {
        torinvestRateLimitHit('fondamental_login_formation');
        throw new RuntimeException('Bridge formation invalide ou expiré');
    }

    $meta = is_array($bridge['meta'] ?? null) ? $bridge['meta'] : [];
    if (($meta['source'] ?? '') !== 'forge_formation' || trim((string) ($meta['email'] ?? '')) === '') {
        torinvestRateLimitHit('fondamental_login_formation');
        throw new RuntimeException('Bridge formation invalide');
    }

    $email = trim((string) $meta['email']);
    $expiresAt = time() + fondaSessionTtl();
    $sessionMeta = [
        'source' => 'formation',
        'email' => $email,
        'level' => 'FORGE_PREMIUM',
    ];
    $token = aiAccessGenerateToken($expiresAt, 'client', $sessionMeta, $secret);
    torinvestSessionSetCookie('fondamental_access', $token, $expiresAt);

    $result = [
        'ok' => true,
        'role' => 'client',
        'source' => 'formation',
        'email' => $email,
        'expiresAt' => $expiresAt,
        'sessionToken' => $token,
    ];

    return $result;
}

function fondaLoginAdmin(string $pin): array
{
    torinvestRateLimitGuard('fondamental_login_admin', 10, 60);
    $cfg = fondaConfig();
    $expected = trim((string) ($cfg['licence_crm_pin'] ?? ''));
    if ($expected === '' || $expected === 'CHANGEZ_MOI_CRM') {
        $expected = trim((string) ($cfg['dev_access_pin'] ?? ''));
    }
    if ($expected === '' || !hash_equals($expected, trim($pin))) {
        torinvestRateLimitHit('fondamental_login_admin');
        throw new RuntimeException('PIN admin incorrect');
    }
    $expiresAt = time() + fondaSessionTtl();
    $token = aiAccessGenerateToken(
        $expiresAt,
        'admin',
        ['label' => 'admin_fondamental'],
        aiAccessHmacSecret()
    );
    torinvestSessionSetCookie('fondamental_access', $token, $expiresAt);
    return [
        'ok' => true,
        'role' => 'admin',
        'expiresAt' => $expiresAt,
        'label' => 'Admin Fondamental',
    ];
}

function fondaPing(array $session): array
{
    if (($session['role'] ?? '') === 'admin') {
        return [
            'ok' => true,
            'role' => 'admin',
            'expiresAt' => $session['expiresAt'],
            'minKrm' => fondaMinKrm(),
        ];
    }

    $meta = is_array($session['meta'] ?? null) ? $session['meta'] : [];
    if (($meta['source'] ?? '') === 'formation') {
        return [
            'ok' => true,
            'role' => 'client',
            'source' => 'formation',
            'email' => (string) ($meta['email'] ?? ''),
            'expiresAt' => $session['expiresAt'],
            'minKrm' => fondaMinKrm(),
        ];
    }

    $wallet = (string) ($meta['wallet'] ?? '');
    if ($wallet === '') {
        throw new RuntimeException('Session sans wallet');
    }
    $bal = fondaReadKrmBalance($wallet);
    $min = fondaMinKrm();
    if ($bal + 1e-9 < $min) {
        torinvestSessionClearCookie('fondamental_access');
        throw new RuntimeException('Accès révoqué — solde KRM sous le seuil ACADEMY');
    }
    return [
        'ok' => true,
        'role' => 'client',
        'wallet' => $wallet,
        'krm' => $bal,
        'minKrm' => $min,
        'expiresAt' => $session['expiresAt'],
    ];
}

function fondaRequireSession(): array
{
    $session = fondaReadSession();
    if ($session === null) {
        throw new RuntimeException('unauthorized');
    }
    return $session;
}
