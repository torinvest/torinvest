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
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS licence_form_submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            form_name TEXT NOT NULL,
            email TEXT,
            netlify_id TEXT,
            netlify_number INTEGER,
            source TEXT,
            provision_ok INTEGER NOT NULL DEFAULT 0,
            license_code TEXT,
            error TEXT,
            payload_json TEXT
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_form_submissions_created ON licence_form_submissions(created_at)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON licence_form_submissions(form_name)');
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS stripe_webhook_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL UNIQUE,
            event_type TEXT NOT NULL,
            stripe_ref TEXT,
            email TEXT,
            plan_type TEXT,
            created_at TEXT NOT NULL,
            provision_ok INTEGER NOT NULL DEFAULT 0,
            license_code TEXT,
            error TEXT,
            payload_json TEXT
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_stripe_events_ref ON stripe_webhook_events(stripe_ref)');
    return $pdo;
}

function licenceCrmRecordIsUsable(array $row): bool
{
    $expires = trim((string) ($row['expires_at'] ?? ''));
    if ($expires === '') {
        return true;
    }
    $ts = strtotime($expires);
    if ($ts === false) {
        return true;
    }
    return $ts > time();
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
    $allowed = ['VIP', 'FORGE', 'ACCOMPAGNEMENT'];
    if ($type && in_array($type, $allowed, true)) {
        $stmt = $pdo->prepare('SELECT * FROM licence_records WHERE type = :type ORDER BY id DESC LIMIT ' . $limit);
        $stmt->execute([':type' => $type]);
    } else {
        $stmt = $pdo->query('SELECT * FROM licence_records ORDER BY id DESC LIMIT ' . $limit);
    }
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function licenceCrmSplitName(string $full): array
{
    $full = trim($full);
    if ($full === '') {
        return ['', ''];
    }
    $parts = preg_split('/\s+/', $full, 2);
    return [$parts[0] ?? '', $parts[1] ?? ''];
}

function licenceCrmFindActiveByEmailPlan(string $email, string $type): ?array
{
    $email = strtolower(trim($email));
    if ($email === '') {
        return null;
    }
    $pdo = licenceCrmPdo();
    $stmt = $pdo->prepare(
        'SELECT * FROM licence_records WHERE lower(email) = :email AND type = :type
         AND status IN ("active", "reused", "pending_activation")
         ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([':email' => $email, ':type' => $type]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || !licenceCrmRecordIsUsable($row)) {
        return null;
    }
    return $row;
}

function licenceCrmAccessLinks(): array
{
    $cfg = licenceCrmConfig();
    return [
        'discordPublic' => (string) ($cfg['discord_public_url'] ?? 'https://discord.gg/5mSC8gFsT7'),
        'discordAccompagnement' => (string) ($cfg['discord_accompagnement_url'] ?? $cfg['discord_public_url'] ?? 'https://discord.gg/5mSC8gFsT7'),
        'telegramPublic' => (string) ($cfg['telegram_public_url'] ?? 'https://t.me/+2qMkEX3KnhowNTU0'),
        'telegramVip' => (string) ($cfg['telegram_vip_url'] ?? $cfg['telegram_public_url'] ?? 'https://t.me/+2qMkEX3KnhowNTU0'),
        'appLoginUrl' => (string) ($cfg['app_formation_login_url'] ?? 'https://app.torinvest-trading.com/login.html'),
        'workerValidateUrl' => rtrim((string) ($cfg['worker_url'] ?? 'https://morning-hall-d8f6.onzerimes.workers.dev'), '/') . '/validate-license',
    ];
}

function licenceProvisionWebhookSecret(): string
{
    $cfg = licenceCrmConfig();
    return trim((string) ($cfg['provision_webhook_secret'] ?? ''));
}

function licenceProvisionIsWebhookRequest(): bool
{
    $secret = licenceProvisionWebhookSecret();
    if ($secret === '') {
        return false;
    }
    $header = trim((string) ($_SERVER['HTTP_X_PROVISION_KEY'] ?? ''));
    $query = trim((string) ($_GET['provision_key'] ?? ''));
    if ($header !== '' && hash_equals($secret, $header)) {
        return true;
    }
    if ($query !== '' && hash_equals($secret, $query)) {
        return true;
    }
    return false;
}

function licenceProvisionParseNetlifyPayload(array $input): ?array
{
    $root = $input;
    if (isset($input['payload']) && is_array($input['payload'])) {
        $root = $input['payload'];
    }
    $data = $root['data'] ?? [];
    if (!is_array($data)) {
        $data = [];
    }
    $formName = (string) (
        $root['form_name']
        ?? $root['name']
        ?? $data['form-name']
        ?? $input['form_name']
        ?? $input['form-name']
        ?? ''
    );
    if ($formName === '') {
        return null;
    }
    if (empty($data['email']) && !empty($root['email'])) {
        $data['email'] = $root['email'];
    }
    return [
        'form_name' => $formName,
        'data' => $data,
        'netlify_id' => (string) ($root['id'] ?? $input['netlify_id'] ?? ''),
        'netlify_number' => isset($root['number']) ? (int) $root['number'] : (isset($input['netlify_number']) ? (int) $input['netlify_number'] : null),
    ];
}

function licenceFormSubmissionFindByNetlifyId(string $netlifyId): ?array
{
    $netlifyId = trim($netlifyId);
    if ($netlifyId === '') {
        return null;
    }
    $pdo = licenceCrmPdo();
    $stmt = $pdo->prepare('SELECT * FROM licence_form_submissions WHERE netlify_id = :id LIMIT 1');
    $stmt->execute([':id' => $netlifyId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function licenceFormSubmissionLog(array $entry): int
{
    $pdo = licenceCrmPdo();
    $stmt = $pdo->prepare(
        'INSERT INTO licence_form_submissions
         (created_at, form_name, email, netlify_id, netlify_number, source, provision_ok, license_code, error, payload_json)
         VALUES (:created_at, :form_name, :email, :netlify_id, :netlify_number, :source, :provision_ok, :license_code, :error, :payload_json)'
    );
    $stmt->execute([
        ':created_at' => gmdate('c'),
        ':form_name' => (string) ($entry['form_name'] ?? ''),
        ':email' => (string) ($entry['email'] ?? ''),
        ':netlify_id' => ($entry['netlify_id'] ?? '') !== '' ? (string) $entry['netlify_id'] : null,
        ':netlify_number' => isset($entry['netlify_number']) ? (int) $entry['netlify_number'] : null,
        ':source' => (string) ($entry['source'] ?? 'webhook'),
        ':provision_ok' => !empty($entry['provision_ok']) ? 1 : 0,
        ':license_code' => ($entry['license_code'] ?? '') !== '' ? (string) $entry['license_code'] : null,
        ':error' => ($entry['error'] ?? '') !== '' ? (string) $entry['error'] : null,
        ':payload_json' => json_encode($entry['payload'] ?? [], JSON_UNESCAPED_UNICODE),
    ]);
    return (int) $pdo->lastInsertId();
}

function licenceCrmListFormSubmissions(?string $formName = null, int $limit = 100): array
{
    $pdo = licenceCrmPdo();
    $limit = max(1, min(500, $limit));
    if ($formName !== null && $formName !== '') {
        $stmt = $pdo->prepare(
            'SELECT * FROM licence_form_submissions WHERE form_name = :form ORDER BY id DESC LIMIT ' . $limit
        );
        $stmt->execute([':form' => $formName]);
    } else {
        $stmt = $pdo->query('SELECT * FROM licence_form_submissions ORDER BY id DESC LIMIT ' . $limit);
    }
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function licenceCrmNotifyProvisionDiscord(array $event): void
{
    $cfg = licenceCrmConfig();
    $url = trim((string) ($cfg['provision_notify_discord_webhook'] ?? ''));
    if ($url === '') {
        return;
    }
    $ok = !empty($event['provision_ok']);
    $form = (string) ($event['form_name'] ?? '?');
    $email = (string) ($event['email'] ?? '—');
    $license = (string) ($event['license_code'] ?? '');
    $error = (string) ($event['error'] ?? '');
    $source = (string) ($event['source'] ?? 'webhook');
    $color = $ok ? 5763719 : 15548997;
    $title = $ok ? 'Formulaire Netlify — licence OK' : 'Formulaire Netlify — échec provision';
    $fields = [
        ['name' => 'Formulaire', 'value' => $form, 'inline' => true],
        ['name' => 'Email', 'value' => $email, 'inline' => true],
        ['name' => 'Source', 'value' => $source, 'inline' => true],
    ];
    if ($license !== '') {
        $fields[] = ['name' => 'Licence', 'value' => '`' . $license . '`', 'inline' => false];
    }
    if ($error !== '') {
        $fields[] = ['name' => 'Erreur', 'value' => substr($error, 0, 900), 'inline' => false];
    }
    $body = json_encode([
        'embeds' => [[
            'title' => $title,
            'color' => $color,
            'fields' => $fields,
            'timestamp' => gmdate('c'),
        ]],
    ], JSON_UNESCAPED_UNICODE);
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $body,
            'timeout' => 8,
            'ignore_errors' => true,
        ],
    ]);
    @file_get_contents($url, false, $ctx);
}

function licenceCrmHandleNetlifyFormWebhook(array $input, string $source = 'netlify_webhook'): array
{
    $parsed = licenceProvisionParseNetlifyPayload($input);
    if ($parsed === null) {
        throw new InvalidArgumentException('payload_netlify_invalide');
    }
    $formName = $parsed['form_name'];

    if ($formName === 'liste-attente-torinvest') {
        return licenceCrmHandleWaitlistForm($parsed, $source);
    }

    $cfg = licenceCrmConfig();
    if (empty($cfg['allow_form_provision'])) {
        return licenceCrmHandleNetlifyFormMetadata($input, $source);
    }

    $data = $parsed['data'];
    $netlifyId = $parsed['netlify_id'];
    $email = strtolower(trim((string) ($data['email'] ?? '')));

    if ($netlifyId !== '') {
        $existing = licenceFormSubmissionFindByNetlifyId($netlifyId);
        if ($existing && (int) ($existing['provision_ok'] ?? 0) === 1 && !empty($existing['license_code'])) {
            return [
                'ok' => true,
                'reused' => true,
                'deduped' => true,
                'form_name' => $formName,
                'email' => $email,
                'license' => (string) $existing['license_code'],
                'submission_id' => (int) $existing['id'],
            ];
        }
    }

    $result = null;
    $error = null;
    try {
        if ($formName === 'activation-accompagnement-torinvest') {
            $result = licenceCrmProvisionAccompagnementFromForm($data);
        } elseif ($formName === 'activation-torinvest') {
            $result = licenceCrmProvisionVipFromForm($data);
        } else {
            throw new InvalidArgumentException('form_inconnu: ' . $formName);
        }
    } catch (Throwable $e) {
        $error = $e->getMessage();
    }

    $logId = licenceFormSubmissionLog([
        'form_name' => $formName,
        'email' => $email,
        'netlify_id' => $netlifyId,
        'netlify_number' => $parsed['netlify_number'],
        'source' => $source,
        'provision_ok' => $result && !empty($result['ok']),
        'license_code' => $result['license'] ?? $result['code'] ?? null,
        'error' => $error,
        'payload' => ['form_name' => $formName, 'data' => $data, 'netlify_id' => $netlifyId],
    ]);

    licenceCrmNotifyProvisionDiscord([
        'form_name' => $formName,
        'email' => $email,
        'provision_ok' => $result && !empty($result['ok']),
        'license_code' => $result['license'] ?? $result['code'] ?? '',
        'error' => $error ?? '',
        'source' => $source,
    ]);

    if ($error !== null) {
        throw new RuntimeException($error);
    }
    $result['submission_id'] = $logId;
    $result['form_name'] = $formName;
    return $result;
}

function licenceCrmLogFormProvisionEvent(string $formName, array $input, ?array $result, ?string $error, string $source): int
{
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    return licenceFormSubmissionLog([
        'form_name' => $formName,
        'email' => $email,
        'source' => $source,
        'provision_ok' => $result !== null && !empty($result['ok']),
        'license_code' => $result['license'] ?? $result['code'] ?? null,
        'error' => $error,
        'payload' => [
            'form_name' => $formName,
            'email' => $email,
            'reused' => $result['reused'] ?? false,
            'plan' => $input['plan'] ?? null,
        ],
    ]);
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

function licenceCrmCreateAccompagnement(array $input): array
{
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $days = (int) ($input['days'] ?? 365);
    $firstName = trim((string) ($input['first_name'] ?? ''));
    $lastName = trim((string) ($input['last_name'] ?? ''));
    $stripeRef = trim((string) ($input['stripe_ref'] ?? ''));
    $notes = trim((string) ($input['notes'] ?? ''));
    $discord = trim((string) ($input['discord'] ?? ''));
    $level = trim((string) ($input['level'] ?? ''));
    $message = trim((string) ($input['message'] ?? ''));
    $source = trim((string) ($input['source'] ?? 'crm'));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email client invalide');
    }
    if ($days < 30 || $days > 3650) {
        $days = 365;
    }

    $existing = licenceCrmFindActiveByEmailPlan($email, 'ACCOMPAGNEMENT');
    if ($existing && !empty($existing['license_code'])) {
        return [
            'ok' => true,
            'reused' => true,
            'id' => (int) $existing['id'],
            'type' => 'ACCOMPAGNEMENT',
            'license' => (string) $existing['license_code'],
            'email' => $email,
            'expires' => (string) ($existing['expires_at'] ?? ''),
            'status' => (string) ($existing['status'] ?? 'active'),
            'plan' => 'ACCOMPAGNEMENT',
            'days' => (int) ($existing['days'] ?? $days),
            'accessLinks' => licenceCrmAccessLinks(),
        ];
    }

    $noteParts = array_filter([
        $notes !== '' ? $notes : null,
        $discord !== '' ? 'Discord: ' . $discord : null,
        $level !== '' ? 'Niveau: ' . $level : null,
        $message !== '' ? 'Message: ' . $message : null,
        'Source: ' . $source,
    ]);
    $notesMerged = implode("\n", $noteParts);

    $create = licenceCrmWorkerPost('/license/create', [
        'email' => $email,
        'plan' => 'ACCOMPAGNEMENT',
        'days' => $days,
        'autoActivate' => true,
    ], true);

    if (empty($create['ok']) || empty($create['license'])) {
        $err = $create['error'] ?? ('HTTP ' . ($create['_httpStatus'] ?? '?'));
        throw new RuntimeException('Création accompagnement échouée : ' . $err);
    }

    $license = (string) $create['license'];
    $expires = (string) ($create['expires'] ?? '');
    $status = (string) ($create['status'] ?? 'active');

    $id = licenceCrmInsertRecord([
        'type' => 'ACCOMPAGNEMENT',
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'license_code' => $license,
        'plan' => 'ACCOMPAGNEMENT',
        'days' => $days,
        'expires_at' => $expires,
        'activation_code' => null,
        'mt5_account' => null,
        'stripe_ref' => $stripeRef !== '' ? $stripeRef : null,
        'status' => $status,
        'notes' => $notesMerged !== '' ? $notesMerged : null,
        'worker_response' => json_encode(['create' => $create], JSON_UNESCAPED_UNICODE),
    ]);

    return [
        'ok' => true,
        'reused' => false,
        'id' => $id,
        'type' => 'ACCOMPAGNEMENT',
        'license' => $license,
        'email' => $email,
        'expires' => $expires,
        'status' => $status,
        'plan' => 'ACCOMPAGNEMENT',
        'days' => $days,
        'accessLinks' => licenceCrmAccessLinks(),
    ];
}

function licenceCrmProvisionVipFromForm(array $input): array
{
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email invalide');
    }

    $existing = licenceCrmFindActiveByEmailPlan($email, 'VIP');
    if ($existing && !empty($existing['license_code'])) {
        return [
            'ok' => true,
            'reused' => true,
            'type' => 'VIP',
            'license' => (string) $existing['license_code'],
            'activationCode' => (string) ($existing['activation_code'] ?? ''),
            'email' => $email,
            'expires' => (string) ($existing['expires_at'] ?? ''),
            'status' => (string) ($existing['status'] ?? 'pending_activation'),
        ];
    }

    [$firstName, $lastName] = licenceCrmSplitName((string) ($input['name'] ?? ''));
    $notes = trim((string) ($input['message'] ?? ''));
    if ($notes === '' && !empty($input['plan'])) {
        $notes = 'Offre formulaire: ' . trim((string) $input['plan']);
    }

    return licenceCrmCreateVip([
        'email' => $email,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'stripe_ref' => trim((string) ($input['stripeRef'] ?? $input['stripe_ref'] ?? '')),
        'plan' => 'VIP',
        'days' => (int) ($input['days'] ?? 30),
        'mt5_account' => trim((string) ($input['mt5_account'] ?? '')),
        'notes' => ($notes !== '' ? $notes : 'Source: formulaire activation') . "\nSource: auto-provision",
    ]);
}

function licenceCrmProvisionAccompagnementFromForm(array $input): array
{
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email invalide');
    }

    [$firstName, $lastName] = licenceCrmSplitName((string) ($input['name'] ?? ''));
    return licenceCrmCreateAccompagnement([
        'email' => $email,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'stripe_ref' => trim((string) ($input['stripeRef'] ?? $input['stripe_ref'] ?? '')),
        'discord' => trim((string) ($input['discord'] ?? '')),
        'level' => trim((string) ($input['level'] ?? '')),
        'message' => trim((string) ($input['message'] ?? '')),
        'days' => 365,
        'source' => 'formulaire activation',
    ]);
}

function licenceCrmStripeWebhookSecret(): string
{
    $cfg = licenceCrmConfig();
    return trim((string) ($cfg['stripe_webhook_secret'] ?? ''));
}

function licenceCrmFindByStripeRef(string $stripeRef): ?array
{
    $stripeRef = trim($stripeRef);
    if ($stripeRef === '') {
        return null;
    }
    $pdo = licenceCrmPdo();
    $stmt = $pdo->prepare(
        'SELECT * FROM licence_records WHERE stripe_ref = :ref ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([':ref' => $stripeRef]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function licenceStripeEventFind(string $eventId): ?array
{
    $eventId = trim($eventId);
    if ($eventId === '') {
        return null;
    }
    $pdo = licenceCrmPdo();
    $stmt = $pdo->prepare('SELECT * FROM stripe_webhook_events WHERE event_id = :id LIMIT 1');
    $stmt->execute([':id' => $eventId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function licenceStripeEventLog(array $entry): int
{
    $pdo = licenceCrmPdo();
    $stmt = $pdo->prepare(
        'INSERT INTO stripe_webhook_events
         (event_id, event_type, stripe_ref, email, plan_type, created_at, provision_ok, license_code, error, payload_json)
         VALUES (:event_id, :event_type, :stripe_ref, :email, :plan_type, :created_at, :provision_ok, :license_code, :error, :payload_json)'
    );
    $stmt->execute([
        ':event_id' => (string) ($entry['event_id'] ?? ''),
        ':event_type' => (string) ($entry['event_type'] ?? ''),
        ':stripe_ref' => ($entry['stripe_ref'] ?? '') !== '' ? (string) $entry['stripe_ref'] : null,
        ':email' => ($entry['email'] ?? '') !== '' ? (string) $entry['email'] : null,
        ':plan_type' => ($entry['plan_type'] ?? '') !== '' ? (string) $entry['plan_type'] : null,
        ':created_at' => gmdate('c'),
        ':provision_ok' => !empty($entry['provision_ok']) ? 1 : 0,
        ':license_code' => ($entry['license_code'] ?? '') !== '' ? (string) $entry['license_code'] : null,
        ':error' => ($entry['error'] ?? '') !== '' ? (string) $entry['error'] : null,
        ':payload_json' => json_encode($entry['payload'] ?? [], JSON_UNESCAPED_UNICODE),
    ]);
    return (int) $pdo->lastInsertId();
}

function licenceCrmStripePlanDefinitions(): array
{
    $cfg = licenceCrmConfig();
    return [
        'VIP' => [
            'type' => 'VIP',
            'days' => (int) ($cfg['stripe_vip_days'] ?? 30),
            'amounts' => array_values(array_filter(array_map('intval', (array) ($cfg['stripe_vip_amounts'] ?? [7900])))),
            'payment_link_ids' => array_values(array_filter(array_map('trim', (array) ($cfg['stripe_payment_link_vip_ids'] ?? [])))),
            'payment_link_slugs' => array_values(array_filter(array_map('trim', (array) ($cfg['stripe_payment_link_vip_slugs'] ?? ['eVq14nclt5XV3ka0zFd7q02', '28E28rbhpdqn5si827d7q00'])))),
            'price_ids' => array_values(array_filter(array_map('trim', (array) ($cfg['stripe_price_vip_ids'] ?? [])))),
            'metadata_values' => ['vip', 'robot', 'robot_access'],
        ],
        'ACCOMPAGNEMENT' => [
            'type' => 'ACCOMPAGNEMENT',
            'days' => (int) ($cfg['stripe_accompagnement_days'] ?? 365),
            'amounts' => array_values(array_filter(array_map('intval', (array) ($cfg['stripe_accompagnement_amounts'] ?? [34900])))),
            'payment_link_ids' => array_values(array_filter(array_map('trim', (array) ($cfg['stripe_payment_link_accompagnement_ids'] ?? [])))),
            'payment_link_slugs' => array_values(array_filter(array_map('trim', (array) ($cfg['stripe_payment_link_accompagnement_slugs'] ?? ['aFabJ10CLeurf2S827d7q01'])))),
            'price_ids' => array_values(array_filter(array_map('trim', (array) ($cfg['stripe_price_accompagnement_ids'] ?? [])))),
            'metadata_values' => ['accompagnement', 'formation', 'accompagnement_349'],
        ],
    ];
}

function licenceCrmResolveStripePlan(array $session): ?array
{
    $definitions = licenceCrmStripePlanDefinitions();
    $metadata = is_array($session['metadata'] ?? null) ? $session['metadata'] : [];
    $metaPlan = strtolower(trim((string) ($metadata['torinvest_plan'] ?? $metadata['plan'] ?? '')));

    if ($metaPlan !== '') {
        foreach ($definitions as $key => $def) {
            if (in_array($metaPlan, $def['metadata_values'], true) || strtolower($key) === $metaPlan) {
                return $def + ['plan_key' => $key];
            }
        }
    }

    $paymentLink = trim((string) ($session['payment_link'] ?? ''));
    if ($paymentLink !== '') {
        foreach ($definitions as $key => $def) {
            if (in_array($paymentLink, $def['payment_link_ids'], true)) {
                return $def + ['plan_key' => $key];
            }
        }
    }

    $haystack = json_encode($session, JSON_UNESCAPED_UNICODE) ?: '';
    foreach ($definitions as $key => $def) {
        foreach ($def['payment_link_slugs'] as $slug) {
            if ($slug !== '' && str_contains($haystack, $slug)) {
                return $def + ['plan_key' => $key];
            }
        }
    }

    $lineItems = $session['line_items']['data'] ?? [];
    if (is_array($lineItems)) {
        foreach ($lineItems as $item) {
            if (!is_array($item)) {
                continue;
            }
            $priceId = trim((string) ($item['price']['id'] ?? $item['price'] ?? ''));
            if ($priceId === '') {
                continue;
            }
            foreach ($definitions as $key => $def) {
                if (in_array($priceId, $def['price_ids'], true)) {
                    return $def + ['plan_key' => $key];
                }
            }
        }
    }

    $amount = (int) ($session['amount_total'] ?? 0);
    if ($amount > 0) {
        foreach ($definitions as $key => $def) {
            if (in_array($amount, $def['amounts'], true)) {
                return $def + ['plan_key' => $key];
            }
        }
    }

    return null;
}

function licenceCrmExtractStripeCheckoutContext(array $session): array
{
    $customer = is_array($session['customer_details'] ?? null) ? $session['customer_details'] : [];
    $email = strtolower(trim((string) ($customer['email'] ?? $session['customer_email'] ?? '')));
    [$firstName, $lastName] = licenceCrmSplitName((string) ($customer['name'] ?? ''));

    $stripeRef = trim((string) ($session['payment_intent'] ?? ''));
    if ($stripeRef === '') {
        $stripeRef = trim((string) ($session['subscription'] ?? ''));
    }
    if ($stripeRef === '') {
        $stripeRef = trim((string) ($session['id'] ?? ''));
    }

    return [
        'email' => $email,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'stripe_ref' => $stripeRef,
        'session_id' => trim((string) ($session['id'] ?? '')),
    ];
}

function licenceCrmProvisionFromStripeCheckout(array $session): array
{
    if (($session['payment_status'] ?? '') !== 'paid' && empty($session['subscription'])) {
        throw new InvalidArgumentException('paiement_non_confirme');
    }

    $plan = licenceCrmResolveStripePlan($session);
    if ($plan === null) {
        throw new InvalidArgumentException('produit_stripe_inconnu');
    }

    $ctx = licenceCrmExtractStripeCheckoutContext($session);
    if (!filter_var($ctx['email'], FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('email_stripe_manquant');
    }

    foreach ([$ctx['stripe_ref'], $ctx['session_id']] as $ref) {
        if ($ref === '') {
            continue;
        }
        $existingByRef = licenceCrmFindByStripeRef($ref);
        if ($existingByRef && !empty($existingByRef['license_code'])) {
            return [
                'ok' => true,
                'reused' => true,
                'deduped' => true,
                'dedupe_reason' => 'stripe_ref',
                'type' => (string) ($existingByRef['type'] ?? $plan['type']),
                'license' => (string) $existingByRef['license_code'],
                'activationCode' => (string) ($existingByRef['activation_code'] ?? ''),
                'email' => $ctx['email'],
                'expires' => (string) ($existingByRef['expires_at'] ?? ''),
                'status' => (string) ($existingByRef['status'] ?? 'active'),
                'stripe_ref' => $ref,
                'plan_key' => $plan['plan_key'],
            ];
        }
    }

    if ($plan['type'] === 'ACCOMPAGNEMENT') {
        $result = licenceCrmCreateAccompagnement([
            'email' => $ctx['email'],
            'first_name' => $ctx['first_name'],
            'last_name' => $ctx['last_name'],
            'stripe_ref' => $ctx['stripe_ref'],
            'days' => (int) $plan['days'],
            'source' => 'stripe webhook',
            'notes' => 'Stripe session ' . $ctx['session_id'],
        ]);
    } else {
        $result = licenceCrmCreateVip([
            'email' => $ctx['email'],
            'first_name' => $ctx['first_name'],
            'last_name' => $ctx['last_name'],
            'stripe_ref' => $ctx['stripe_ref'],
            'plan' => 'VIP',
            'days' => (int) $plan['days'],
            'notes' => 'Stripe session ' . $ctx['session_id'] . "\nSource: stripe webhook",
        ]);
    }

    $result['stripe_ref'] = $ctx['stripe_ref'];
    $result['plan_key'] = $plan['plan_key'];
    $result['first_name'] = $ctx['first_name'];
    $result['last_name'] = $ctx['last_name'];
    return $result;
}

function licenceCrmNotifyStripeDiscord(array $event): void
{
    $cfg = licenceCrmConfig();
    $url = trim((string) ($cfg['provision_notify_discord_webhook'] ?? ''));
    if ($url === '') {
        return;
    }

    $ok = !empty($event['provision_ok']);
    $email = (string) ($event['email'] ?? '—');
    $license = (string) ($event['license_code'] ?? '');
    $error = (string) ($event['error'] ?? '');
    $plan = (string) ($event['plan_type'] ?? '?');
    $stripeRef = (string) ($event['stripe_ref'] ?? '');
    $color = $ok ? 5763719 : 15548997;
    $title = $ok ? 'Stripe — licence OK' : 'Stripe — échec provision';

    $fields = [
        ['name' => 'Plan', 'value' => $plan, 'inline' => true],
        ['name' => 'Email', 'value' => $email, 'inline' => true],
    ];
    if ($stripeRef !== '') {
        $fields[] = ['name' => 'Réf. Stripe', 'value' => '`' . $stripeRef . '`', 'inline' => false];
    }
    if ($license !== '') {
        $fields[] = ['name' => 'Licence', 'value' => '`' . $license . '`', 'inline' => false];
    }
    if ($error !== '') {
        $fields[] = ['name' => 'Erreur', 'value' => substr($error, 0, 900), 'inline' => false];
    }

    $body = json_encode([
        'embeds' => [[
            'title' => $title,
            'color' => $color,
            'fields' => $fields,
            'timestamp' => gmdate('c'),
        ]],
    ], JSON_UNESCAPED_UNICODE);

    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $body,
            'timeout' => 8,
            'ignore_errors' => true,
        ],
    ]);
    @file_get_contents($url, false, $ctx);
}

function licenceCrmAppendRecordNotes(int $recordId, string $append): void
{
    if ($append === '') {
        return;
    }
    $pdo = licenceCrmPdo();
    $stmt = $pdo->prepare('SELECT notes FROM licence_records WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $recordId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return;
    }
    $existing = trim((string) ($row['notes'] ?? ''));
    $merged = $existing !== '' ? $existing . "\n---\n" . $append : $append;
    $upd = $pdo->prepare('UPDATE licence_records SET notes = :notes WHERE id = :id');
    $upd->execute([':notes' => $merged, ':id' => $recordId]);
}

function licenceCrmExtendLicenseDays(string $licenseCode, int $days, ?string $stripeRef = null): array
{
    $licenseCode = trim($licenseCode);
    if ($licenseCode === '') {
        throw new InvalidArgumentException('licence_manquante');
    }
    if ($days < 1) {
        $days = 30;
    }

    $extend = licenceCrmWorkerPost('/license/extend', [
        'license' => $licenseCode,
        'days' => $days,
    ], true);

    if (empty($extend['ok'])) {
        $err = $extend['error'] ?? ('HTTP ' . ($extend['_httpStatus'] ?? '?'));
        throw new RuntimeException('Prolongation licence échouée : ' . $err);
    }

    $pdo = licenceCrmPdo();
    $sql = 'UPDATE licence_records SET expires_at = :expires, status = :status';
    $params = [
        ':expires' => (string) ($extend['expires'] ?? ''),
        ':status' => (string) ($extend['status'] ?? 'active'),
        ':license' => $licenseCode,
    ];
    if ($stripeRef !== null && $stripeRef !== '') {
        $sql .= ', stripe_ref = :stripe_ref';
        $params[':stripe_ref'] = $stripeRef;
    }
    $sql .= ' WHERE license_code = :license';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    return [
        'ok' => true,
        'extended' => true,
        'license' => $licenseCode,
        'expires' => (string) ($extend['expires'] ?? ''),
        'days' => $days,
    ];
}

function licenceCrmResolveRenewalFromInvoice(array $invoice): ?array
{
    $amount = (int) ($invoice['amount_paid'] ?? $invoice['total'] ?? 0);
    $definitions = licenceCrmStripePlanDefinitions();
    foreach ($definitions as $key => $def) {
        if (in_array($amount, $def['amounts'], true)) {
            return $def + ['plan_key' => $key];
        }
    }
    return null;
}

function licenceCrmHandleStripeInvoiceRenewal(array $invoice): array
{
    $billingReason = (string) ($invoice['billing_reason'] ?? '');
    if ($billingReason === 'subscription_create') {
        return ['ok' => true, 'ignored' => true, 'reason' => 'first_invoice_via_checkout'];
    }

    $email = strtolower(trim((string) ($invoice['customer_email'] ?? '')));
    if ($email === '' && !empty($invoice['customer_details']['email'])) {
        $email = strtolower(trim((string) $invoice['customer_details']['email']));
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('email_stripe_manquant');
    }

    $plan = licenceCrmResolveRenewalFromInvoice($invoice);
    if ($plan === null) {
        throw new InvalidArgumentException('montant_facture_inconnu');
    }

    $type = (string) $plan['type'];
    $existing = licenceCrmFindActiveByEmailPlan($email, $type);
    if (!$existing || empty($existing['license_code'])) {
        throw new RuntimeException('licence_introuvable_pour_renouvellement');
    }

    $stripeRef = trim((string) ($invoice['payment_intent'] ?? $invoice['id'] ?? ''));
    $extended = licenceCrmExtendLicenseDays((string) $existing['license_code'], (int) $plan['days'], $stripeRef);

    $extended['email'] = $email;
    $extended['type'] = $type;
    $extended['reused'] = true;
    $extended['renewal'] = true;

    if (trim((string) (licenceCrmConfig()['brevo_api_key'] ?? '')) !== '') {
        require_once __DIR__ . '/brevo-lib.php';
        brevoSendRenewalEmail($type, [
            'email' => $email,
            'first_name' => (string) ($existing['first_name'] ?? ''),
            'license' => (string) $existing['license_code'],
            'expires' => (string) ($extended['expires'] ?? ''),
        ]);
    }

    return $extended;
}

function licenceCrmHandleWaitlistForm(array $parsed, string $source = 'netlify_webhook'): array
{
    $data = $parsed['data'];
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('email_waitlist_invalide');
    }

    [$firstName, $lastName] = licenceCrmSplitName((string) ($data['name'] ?? $data['nom'] ?? ''));
    $brevoResult = null;
    if (trim((string) (licenceCrmConfig()['brevo_api_key'] ?? '')) !== '') {
        require_once __DIR__ . '/brevo-lib.php';
        $brevoResult = brevoSyncWaitlistContact($email, $firstName, $lastName, $data);
    }

    $logId = licenceFormSubmissionLog([
        'form_name' => 'liste-attente-torinvest',
        'email' => $email,
        'netlify_id' => $parsed['netlify_id'] ?? '',
        'netlify_number' => $parsed['netlify_number'] ?? null,
        'source' => $source,
        'provision_ok' => 1,
        'license_code' => null,
        'error' => null,
        'payload' => ['form_name' => 'liste-attente-torinvest', 'data' => $data],
    ]);

    return [
        'ok' => true,
        'waitlist' => true,
        'email' => $email,
        'submission_id' => $logId,
        'brevo' => $brevoResult,
    ];
}

function licenceCrmHandleNetlifyFormMetadata(array $input, string $source = 'netlify_webhook'): array
{
    $parsed = licenceProvisionParseNetlifyPayload($input);
    if ($parsed === null) {
        throw new InvalidArgumentException('payload_netlify_invalide');
    }

    $formName = $parsed['form_name'];
    $data = $parsed['data'];
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $netlifyId = $parsed['netlify_id'];

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('email_invalide');
    }

    $type = $formName === 'activation-accompagnement-torinvest' ? 'ACCOMPAGNEMENT' : 'VIP';
    $existing = licenceCrmFindActiveByEmailPlan($email, $type);
    $error = null;

    if ($existing) {
        $noteParts = array_filter([
            'Formulaire metadata ' . gmdate('Y-m-d H:i') . ' UTC',
            !empty($data['discord']) ? 'Discord: ' . trim((string) $data['discord']) : null,
            !empty($data['level']) ? 'Niveau: ' . trim((string) $data['level']) : null,
            !empty($data['message']) ? 'Message: ' . trim((string) $data['message']) : null,
            !empty($data['plan']) ? 'Offre: ' . trim((string) $data['plan']) : null,
        ]);
        licenceCrmAppendRecordNotes((int) $existing['id'], implode("\n", $noteParts));
    } else {
        $error = 'licence_introuvable_verifie_email_paiement';
    }

    $logId = licenceFormSubmissionLog([
        'form_name' => $formName,
        'email' => $email,
        'netlify_id' => $netlifyId,
        'netlify_number' => $parsed['netlify_number'],
        'source' => $source,
        'provision_ok' => $existing ? 1 : 0,
        'license_code' => $existing['license_code'] ?? null,
        'error' => $error,
        'payload' => ['form_name' => $formName, 'data' => $data, 'metadata_only' => true],
    ]);

    licenceCrmNotifyProvisionDiscord([
        'form_name' => $formName,
        'email' => $email,
        'provision_ok' => (bool) $existing,
        'license_code' => $existing['license_code'] ?? '',
        'error' => $error ?? '',
        'source' => $source . '_metadata',
    ]);

    return [
        'ok' => true,
        'metadata_only' => true,
        'email' => $email,
        'type' => $type,
        'license' => $existing['license_code'] ?? null,
        'submission_id' => $logId,
        'message' => $existing
            ? 'Profil complété — licence déjà envoyée par email après paiement.'
            : 'Profil enregistré — aucune licence trouvée pour cet email (vérifie le paiement Stripe).',
    ];
}

function licenceCrmListStripeEvents(int $limit = 100): array
{
    $pdo = licenceCrmPdo();
    $limit = max(1, min(500, $limit));
    $stmt = $pdo->query('SELECT * FROM stripe_webhook_events ORDER BY id DESC LIMIT ' . $limit);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function licenceCrmResendBrevoLicenseEmail(string $email, ?string $type = null): array
{
    $email = strtolower(trim($email));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email invalide');
    }

    $types = $type && in_array($type, ['VIP', 'ACCOMPAGNEMENT'], true)
        ? [$type]
        : ['VIP', 'ACCOMPAGNEMENT'];

    $record = null;
    foreach ($types as $t) {
        $record = licenceCrmFindActiveByEmailPlan($email, $t);
        if ($record) {
            $type = $t;
            break;
        }
    }

    if (!$record || empty($record['license_code'])) {
        throw new RuntimeException('Aucune licence active pour cet email');
    }

    if (trim((string) (licenceCrmConfig()['brevo_api_key'] ?? '')) === '') {
        throw new RuntimeException('brevo_api_key manquant');
    }

    require_once __DIR__ . '/brevo-lib.php';
    $sent = brevoSendLicenseEmail((string) $type, [
        'email' => $email,
        'first_name' => (string) ($record['first_name'] ?? ''),
        'last_name' => (string) ($record['last_name'] ?? ''),
        'license' => (string) $record['license_code'],
        'activation_code' => (string) ($record['activation_code'] ?? ''),
        'access_links' => licenceCrmAccessLinks(),
    ]);

    return [
        'ok' => true,
        'resent' => true,
        'email' => $email,
        'type' => $type,
        'license' => (string) $record['license_code'],
        'brevo' => $sent,
    ];
}

function licenceCrmNotifyStripePaymentFailed(array $invoice): void
{
    $cfg = licenceCrmConfig();
    $url = trim((string) ($cfg['provision_notify_discord_webhook'] ?? ''));
    if ($url === '') {
        return;
    }

    $email = (string) ($invoice['customer_email'] ?? '—');
    $amount = (int) ($invoice['amount_due'] ?? 0);
    $body = json_encode([
        'embeds' => [[
            'title' => 'Stripe — échec paiement / renouvellement',
            'color' => 15548997,
            'fields' => [
                ['name' => 'Email', 'value' => $email, 'inline' => true],
                ['name' => 'Montant dû', 'value' => number_format($amount / 100, 2, ',', ' ') . ' €', 'inline' => true],
                ['name' => 'Facture', 'value' => '`' . (string) ($invoice['id'] ?? '') . '`', 'inline' => false],
            ],
            'timestamp' => gmdate('c'),
        ]],
    ], JSON_UNESCAPED_UNICODE);

    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $body,
            'timeout' => 8,
            'ignore_errors' => true,
        ],
    ]);
    @file_get_contents($url, false, $ctx);
}

function licenceCrmHandleStripeEvent(array $event): array
{
    $eventId = (string) ($event['id'] ?? '');
    $eventType = (string) ($event['type'] ?? '');

    $existing = licenceStripeEventFind($eventId);
    if ($existing && (int) ($existing['provision_ok'] ?? 0) === 1 && !empty($existing['license_code'])) {
        return [
            'ok' => true,
            'reused' => true,
            'deduped' => true,
            'event_id' => $eventId,
            'license' => (string) $existing['license_code'],
        ];
    }

    $ignoredTypes = ['checkout.session.async_payment_failed', 'checkout.session.expired'];
    if (in_array($eventType, $ignoredTypes, true)) {
        return ['ok' => true, 'ignored' => true, 'event_type' => $eventType];
    }

    $result = null;
    $error = null;
    $planType = null;
    $email = null;
    $stripeRef = null;
    $logOk = false;

    try {
        if ($eventType === 'checkout.session.completed') {
            $session = is_array($event['data']['object'] ?? null) ? $event['data']['object'] : [];
            $result = licenceCrmProvisionFromStripeCheckout($session);
            $planType = (string) ($result['type'] ?? $result['plan_key'] ?? '');
            $email = (string) ($result['email'] ?? '');
            $stripeRef = (string) ($result['stripe_ref'] ?? '');
            $logOk = !empty($result['ok']);

            if (trim((string) (licenceCrmConfig()['brevo_api_key'] ?? '')) !== '') {
                require_once __DIR__ . '/brevo-lib.php';
                $result['brevo'] = brevoSyncAfterProvision($planType, $result);
            }
        } elseif ($eventType === 'invoice.paid') {
            $invoice = is_array($event['data']['object'] ?? null) ? $event['data']['object'] : [];
            $result = licenceCrmHandleStripeInvoiceRenewal($invoice);
            if (!empty($result['ignored'])) {
                return ['ok' => true, 'ignored' => true, 'event_type' => $eventType, 'reason' => $result['reason'] ?? ''];
            }
            $planType = (string) ($result['type'] ?? '');
            $email = (string) ($result['email'] ?? '');
            $stripeRef = trim((string) ($invoice['payment_intent'] ?? $invoice['id'] ?? ''));
            $logOk = !empty($result['ok']);
        } elseif ($eventType === 'invoice.payment_failed') {
            $invoice = is_array($event['data']['object'] ?? null) ? $event['data']['object'] : [];
            licenceCrmNotifyStripePaymentFailed($invoice);
            $email = (string) ($invoice['customer_email'] ?? '');
            $stripeRef = (string) ($invoice['id'] ?? '');
            $logOk = true;
            $result = ['ok' => true, 'notified' => true, 'event_type' => $eventType];
        } else {
            return [
                'ok' => true,
                'ignored' => true,
                'event_type' => $eventType,
            ];
        }
    } catch (Throwable $e) {
        $error = $e->getMessage();
    }

    licenceStripeEventLog([
        'event_id' => $eventId,
        'event_type' => $eventType,
        'stripe_ref' => $stripeRef,
        'email' => $email,
        'plan_type' => $planType,
        'provision_ok' => $logOk && $error === null,
        'license_code' => $result['license'] ?? $result['code'] ?? null,
        'error' => $error,
        'payload' => [
            'type' => $eventType,
            'email' => $email,
            'plan_type' => $planType,
            'stripe_ref' => $stripeRef,
        ],
    ]);

    if ($eventType !== 'invoice.payment_failed') {
        licenceCrmNotifyStripeDiscord([
            'provision_ok' => $logOk && $error === null,
            'email' => $email ?? '',
            'license_code' => $result['license'] ?? $result['code'] ?? '',
            'error' => $error ?? '',
            'plan_type' => $planType ?? ($eventType === 'invoice.paid' ? 'renewal' : ''),
            'stripe_ref' => $stripeRef ?? '',
        ]);
    }

    if ($error !== null) {
        throw new RuntimeException($error);
    }

    $result['event_id'] = $eventId;
    return $result;
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
