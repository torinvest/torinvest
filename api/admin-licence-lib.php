<?php
/**
 * TORINVEST — Bibliothèque CRM licences (admin-licence).
 * Secrets Worker côté serveur uniquement. Ne pas exposer ADMIN_TOKEN au navigateur.
 */

declare(strict_types=1);

function licenceCrmConfig(): array
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

function licenceCrmWorkerUrl(): string
{
    $cfg = licenceCrmConfig();
    return rtrim((string) ($cfg['worker_url'] ?? 'https://morning-hall-d8f6.onzerimes.workers.dev'), '/');
}

function licenceCrmAdminToken(): string
{
    $cfg = licenceCrmConfig();
    $token = (string) ($cfg['admin_token'] ?? $cfg['worker_admin_token'] ?? '');
    if ($token === '') {
        throw new RuntimeException('admin_token manquant dans config.local.php');
    }
    return $token;
}

function licenceCrmPin(): string
{
    $cfg = licenceCrmConfig();
    return (string) ($cfg['licence_crm_pin'] ?? '');
}

function licenceCrmSessionTtl(): int
{
    $cfg = licenceCrmConfig();
    return (int) ($cfg['licence_crm_session_ttl'] ?? 43200); // 12 h
}

function licenceCrmDbPath(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    return $dir . '/licence-crm.sqlite';
}

function licenceCrmPdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $pdo = new PDO('sqlite:' . licenceCrmDbPath());
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS licence_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            created_at TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            wallet TEXT,
            license_code TEXT NOT NULL,
            plan TEXT,
            days INTEGER,
            expires_at TEXT,
            activation_code TEXT,
            mt5_account TEXT,
            stripe_ref TEXT,
            status TEXT,
            notes TEXT,
            worker_response TEXT
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_licence_records_type ON licence_records(type)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_licence_records_email ON licence_records(email)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_licence_records_created ON licence_records(created_at)');
    return $pdo;
}

function licenceCrmGenerateToken(int $expiresAt, string $secret): string
{
    $payload = $expiresAt . '.' . bin2hex(random_bytes(16));
    $sig = hash_hmac('sha256', $payload, $secret);
    return base64_encode($payload . '.' . $sig);
}

function licenceCrmVerifyToken(string $token, string $secret): bool
{
    $decoded = base64_decode($token, true);
    if ($decoded === false) {
        return false;
    }
    $parts = explode('.', $decoded);
    if (count($parts) !== 3) {
        return false;
    }
    [$expiresAt, $nonce, $sig] = $parts;
    $payload = $expiresAt . '.' . $nonce;
    $expected = hash_hmac('sha256', $payload, $secret);
    if (!hash_equals($expected, $sig)) {
        return false;
    }
    return (int) $expiresAt > time();
}

function licenceCrmWorkerPost(string $path, array $body, bool $admin = false): array
{
    $url = licenceCrmWorkerUrl() . $path;
    $headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
    if ($admin) {
        $headers .= 'Authorization: Bearer ' . licenceCrmAdminToken() . "\r\n";
    }

    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => $headers,
            'content' => json_encode($body, JSON_UNESCAPED_UNICODE),
            'timeout' => 25,
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
    $data['_raw'] = $raw;
    return $data;
}

function licenceCrmInsertRecord(array $row): int
{
    $pdo = licenceCrmPdo();
    $stmt = $pdo->prepare(
        'INSERT INTO licence_records (
            type, created_at, first_name, last_name, email, wallet, license_code,
            plan, days, expires_at, activation_code, mt5_account, stripe_ref, status, notes, worker_response
        ) VALUES (
            :type, :created_at, :first_name, :last_name, :email, :wallet, :license_code,
            :plan, :days, :expires_at, :activation_code, :mt5_account, :stripe_ref, :status, :notes, :worker_response
        )'
    );
    $stmt->execute([
        ':type' => $row['type'],
        ':created_at' => $row['created_at'] ?? gmdate('c'),
        ':first_name' => $row['first_name'] ?? null,
        ':last_name' => $row['last_name'] ?? null,
        ':email' => $row['email'] ?? null,
        ':wallet' => $row['wallet'] ?? null,
        ':license_code' => $row['license_code'],
        ':plan' => $row['plan'] ?? null,
        ':days' => $row['days'] ?? null,
        ':expires_at' => $row['expires_at'] ?? null,
        ':activation_code' => $row['activation_code'] ?? null,
        ':mt5_account' => $row['mt5_account'] ?? null,
        ':stripe_ref' => $row['stripe_ref'] ?? null,
        ':status' => $row['status'] ?? null,
        ':notes' => $row['notes'] ?? null,
        ':worker_response' => $row['worker_response'] ?? null,
    ]);
    return (int) $pdo->lastInsertId();
}

function licenceCrmListRecords(?string $type = null, int $limit = 200): array
{
    $pdo = licenceCrmPdo();
    $limit = max(1, min(500, $limit));
    if ($type && in_array($type, ['VIP', 'FORGE'], true)) {
        $stmt = $pdo->prepare('SELECT * FROM licence_records WHERE type = :type ORDER BY id DESC LIMIT ' . $limit);
        $stmt->execute([':type' => $type]);
    } else {
        $stmt = $pdo->query('SELECT * FROM licence_records ORDER BY id DESC LIMIT ' . $limit);
    }
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function licenceCrmCreateVip(array $input): array
{
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $plan = strtoupper(trim((string) ($input['plan'] ?? 'VIP')));
    $days = (int) ($input['days'] ?? 30);
    $mt5 = trim((string) ($input['mt5_account'] ?? ''));
    $firstName = trim((string) ($input['first_name'] ?? ''));
    $lastName = trim((string) ($input['last_name'] ?? ''));
    $stripeRef = trim((string) ($input['stripe_ref'] ?? ''));
    $notes = trim((string) ($input['notes'] ?? ''));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email client invalide');
    }
    if ($days < 1 || $days > 3650) {
        $days = 30;
    }
    if ($plan === '') {
        $plan = 'VIP';
    }

    $create = licenceCrmWorkerPost('/license/create', [
        'email' => $email,
        'plan' => $plan,
        'days' => $days,
    ], true);

    if (empty($create['ok']) || empty($create['license'])) {
        $err = $create['error'] ?? ('HTTP ' . ($create['_httpStatus'] ?? '?'));
        throw new RuntimeException('Création licence échouée : ' . $err);
    }

    $license = (string) $create['license'];
    $activationCode = (string) ($create['activationCode'] ?? '');
    $expires = (string) ($create['expires'] ?? '');
    $status = 'pending_activation';
    $activateResponse = null;

    if ($mt5 !== '' && $activationCode !== '') {
        $activate = licenceCrmWorkerPost('/license/activate', [
            'license' => $license,
            'mt5Account' => $mt5,
            'activationCode' => $activationCode,
        ], false);
        $activateResponse = $activate;
        if (!empty($activate['ok'])) {
            $status = 'active';
            $expires = (string) ($activate['expires'] ?? $expires);
        } else {
            $status = 'activation_failed';
        }
    }

    $workerLog = json_encode(['create' => $create, 'activate' => $activateResponse], JSON_UNESCAPED_UNICODE);

    $id = licenceCrmInsertRecord([
        'type' => 'VIP',
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'license_code' => $license,
        'plan' => $plan,
        'days' => $days,
        'expires_at' => $expires,
        'activation_code' => $activationCode,
        'mt5_account' => $mt5 !== '' ? $mt5 : null,
        'stripe_ref' => $stripeRef !== '' ? $stripeRef : null,
        'status' => $status,
        'notes' => $notes !== '' ? $notes : null,
        'worker_response' => $workerLog,
    ]);

    return [
        'ok' => true,
        'id' => $id,
        'type' => 'VIP',
        'license' => $license,
        'activationCode' => $activationCode,
        'expires' => $expires,
        'status' => $status,
        'mt5Account' => $mt5 !== '' ? $mt5 : null,
        'email' => $email,
        'plan' => $plan,
        'days' => $days,
    ];
}

function licenceCrmActivateVip(array $input): array
{
    $license = trim((string) ($input['license'] ?? ''));
    $mt5 = trim((string) ($input['mt5_account'] ?? ''));
    $activationCode = strtoupper(trim((string) ($input['activation_code'] ?? '')));

    if ($license === '' || $mt5 === '' || $activationCode === '') {
        throw new InvalidArgumentException('Licence, compte MT5 et code d\'activation requis');
    }

    $activate = licenceCrmWorkerPost('/license/activate', [
        'license' => $license,
        'mt5Account' => $mt5,
        'activationCode' => $activationCode,
    ], false);

    if (empty($activate['ok'])) {
        $err = $activate['error'] ?? ('HTTP ' . ($activate['_httpStatus'] ?? '?'));
        throw new RuntimeException('Activation échouée : ' . $err);
    }

    $pdo = licenceCrmPdo();
    $stmt = $pdo->prepare(
        'UPDATE licence_records SET status = :status, mt5_account = :mt5, expires_at = :expires,
         worker_response = :worker WHERE license_code = :license AND type = :type'
    );
    $stmt->execute([
        ':status' => 'active',
        ':mt5' => $mt5,
        ':expires' => (string) ($activate['expires'] ?? ''),
        ':worker' => json_encode(['activate' => $activate], JSON_UNESCAPED_UNICODE),
        ':license' => $license,
        ':type' => 'VIP',
    ]);

    return [
        'ok' => true,
        'license' => $license,
        'mt5Account' => $mt5,
        'expires' => (string) ($activate['expires'] ?? ''),
        'status' => 'active',
    ];
}

function licenceCrmCreateForge(array $input): array
{
    $wallet = trim((string) ($input['wallet'] ?? ''));
    $notes = trim((string) ($input['notes'] ?? ''));
    $firstName = trim((string) ($input['first_name'] ?? ''));
    $lastName = trim((string) ($input['last_name'] ?? ''));

    if ($wallet === '' || strlen($wallet) < 32) {
        throw new InvalidArgumentException('Adresse wallet Solana invalide');
    }

    $resp = licenceCrmWorkerPost('/access-code', ['wallet' => $wallet], true);
    if (empty($resp['ok']) || empty($resp['code'])) {
        $err = $resp['error'] ?? ('HTTP ' . ($resp['_httpStatus'] ?? '?'));
        throw new RuntimeException('Génération FORGE échouée : ' . $err);
    }

    $code = (string) $resp['code'];
    $status = !empty($resp['reused']) ? 'reused' : 'active';

    $id = licenceCrmInsertRecord([
        'type' => 'FORGE',
        'first_name' => $firstName,
        'last_name' => $lastName,
        'wallet' => $wallet,
        'license_code' => $code,
        'plan' => 'FORGERON',
        'status' => $status,
        'notes' => $notes !== '' ? $notes : null,
        'worker_response' => json_encode($resp, JSON_UNESCAPED_UNICODE),
    ]);

    return [
        'ok' => true,
        'id' => $id,
        'type' => 'FORGE',
        'code' => $code,
        'wallet' => $wallet,
        'status' => $status,
        'reused' => !empty($resp['reused']),
    ];
}

function licenceCrmExportCsv(?string $type = null): string
{
    $rows = licenceCrmListRecords($type, 5000);
    $out = fopen('php://temp', 'r+');
    fputcsv($out, [
        'id', 'type', 'created_at', 'first_name', 'last_name', 'email', 'wallet',
        'license_code', 'plan', 'days', 'expires_at', 'activation_code', 'mt5_account',
        'stripe_ref', 'status', 'notes',
    ], ';');
    foreach ($rows as $r) {
        fputcsv($out, [
            $r['id'], $r['type'], $r['created_at'], $r['first_name'], $r['last_name'],
            $r['email'], $r['wallet'], $r['license_code'], $r['plan'], $r['days'],
            $r['expires_at'], $r['activation_code'], $r['mt5_account'], $r['stripe_ref'],
            $r['status'], $r['notes'],
        ], ';');
    }
    rewind($out);
    $csv = stream_get_contents($out);
    fclose($out);
    return $csv ?: '';
}
