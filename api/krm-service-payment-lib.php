<?php
/**
 * Services KRM — vérification on-chain, demandes, anti-reuse signature.
 * Stockage : api/data/krm-services/*.json (VPS).
 * Aucune private key.
 */
declare(strict_types=1);

const KRM_MINT_OFFICIAL = 'Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA';
const KRM_DECIMALS = 6;

const KRM_STATUS_PAID = 'PAID';
const KRM_STATUS_SUBMITTED = 'SUBMITTED';
const KRM_STATUS_IN_REVIEW = 'IN_REVIEW';
const KRM_STATUS_COMPLETED = 'COMPLETED';
const KRM_STATUS_CANCELLED = 'CANCELLED';

function krmServicesCatalog(): array
{
    return [
        'trade_idea_review' => [
            'name' => "Revue pédagogique d'une idée de trade",
            'amountKrm' => 50,
            'amountRaw' => '50000000',
        ],
        'trade_debrief' => [
            'name' => "Débrief pédagogique d'un trade",
            'amountKrm' => 100,
            'amountRaw' => '100000000',
        ],
    ];
}

function krmServicesAllowedStatuses(): array
{
    return [
        KRM_STATUS_PAID,
        KRM_STATUS_SUBMITTED,
        KRM_STATUS_IN_REVIEW,
        KRM_STATUS_COMPLETED,
        KRM_STATUS_CANCELLED,
    ];
}

function krmServicesAdminTransitions(): array
{
    return [
        KRM_STATUS_SUBMITTED => [KRM_STATUS_IN_REVIEW, KRM_STATUS_CANCELLED],
        KRM_STATUS_IN_REVIEW => [KRM_STATUS_COMPLETED, KRM_STATUS_CANCELLED],
        KRM_STATUS_PAID => [KRM_STATUS_CANCELLED],
    ];
}

function krmServicesConfig(): array
{
    $file = __DIR__ . '/config.local.php';
    if (!is_file($file)) {
        return [];
    }
    $cfg = require $file;
    return is_array($cfg) ? $cfg : [];
}

function krmServicesTreasury(): string
{
    $cfg = krmServicesConfig();
    return trim((string) ($cfg['krm_services_treasury'] ?? ''));
}

function krmServicesAdminPin(): string
{
    $cfg = krmServicesConfig();
    $pin = trim((string) ($cfg['licence_crm_pin'] ?? ''));
    if ($pin === '' || $pin === 'CHANGEZ_MOI_CRM') {
        $pin = trim((string) ($cfg['dev_access_pin'] ?? ''));
    }
    return $pin;
}

function krmServicesDataDir(): string
{
    $dir = __DIR__ . '/data/krm-services';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

function krmServicesPaymentsFile(): string
{
    return krmServicesDataDir() . '/payments.json';
}

function krmServicesRequestsFile(): string
{
    return krmServicesDataDir() . '/requests.json';
}

function krmServicesReadJson(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function krmServicesWriteJson(string $path, array $data): void
{
    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $tmp = $path . '.tmp';
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        throw new RuntimeException('JSON_ENCODE_FAILED');
    }
    $fh = fopen($tmp, 'cb');
    if ($fh === false) {
        throw new RuntimeException('WRITE_FAILED');
    }
    try {
        if (!flock($fh, LOCK_EX)) {
            throw new RuntimeException('LOCK_FAILED');
        }
        ftruncate($fh, 0);
        fwrite($fh, $json);
        fflush($fh);
        flock($fh, LOCK_UN);
    } finally {
        fclose($fh);
    }
    if (!rename($tmp, $path)) {
        throw new RuntimeException('RENAME_FAILED');
    }
}

function krmServicesHeliusRpc(array $payload): array
{
    $cfg = krmServicesConfig();
    $apiKey = (string) ($cfg['helius_api_key'] ?? '');
    if ($apiKey === '' || $apiKey === 'VOTRE_CLE_HELIUS_ICI') {
        throw new RuntimeException('HELIUS_NOT_CONFIGURED');
    }
    $url = 'https://mainnet.helius-rpc.com/?api-key=' . urlencode($apiKey);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    $response = curl_exec($ch);
    $errno = curl_errno($ch);
    curl_close($ch);
    if ($response === false || $errno) {
        throw new RuntimeException('RPC_FAILED');
    }
    $data = json_decode($response, true);
    if (!is_array($data)) {
        throw new RuntimeException('RPC_INVALID_JSON');
    }
    if (isset($data['error'])) {
        throw new RuntimeException((string) ($data['error']['message'] ?? 'RPC_ERROR'));
    }
    return $data;
}

function krmServicesGetPayment(string $signature): ?array
{
    $payments = krmServicesReadJson(krmServicesPaymentsFile());
    return isset($payments[$signature]) && is_array($payments[$signature])
        ? $payments[$signature]
        : null;
}

function krmServicesPaymentHasRequest(string $signature): bool
{
    $p = krmServicesGetPayment($signature);
    return is_array($p) && !empty($p['requestId']);
}

function krmServicesCollectInstructions(array $tx): array
{
    $all = [];
    foreach ($tx['transaction']['message']['instructions'] ?? [] as $ix) {
        $all[] = $ix;
    }
    foreach ($tx['meta']['innerInstructions'] ?? [] as $inner) {
        foreach ($inner['instructions'] ?? [] as $ix) {
            $all[] = $ix;
        }
    }
    return $all;
}

function krmServicesBigIntSub(string $a, string $b): string
{
    if (function_exists('bcsub')) {
        return bcsub($a, $b, 0);
    }
    if (function_exists('gmp_strval')) {
        return gmp_strval(gmp_sub($a, $b));
    }
    return (string) ((int) $a - (int) $b);
}

function krmServicesTreasuryGainRaw(array $tx, string $treasury): ?string
{
    $pre = $tx['meta']['preTokenBalances'] ?? [];
    $post = $tx['meta']['postTokenBalances'] ?? [];
    if (!is_array($post)) {
        return null;
    }
    $gain = null;
    foreach ($post as $p) {
        if (($p['mint'] ?? '') !== KRM_MINT_OFFICIAL) {
            continue;
        }
        if (($p['owner'] ?? '') !== $treasury) {
            continue;
        }
        $accountIndex = $p['accountIndex'] ?? null;
        $preAmt = '0';
        foreach ($pre as $row) {
            if (($row['accountIndex'] ?? null) === $accountIndex) {
                $preAmt = (string) ($row['uiTokenAmount']['amount'] ?? '0');
                break;
            }
        }
        $postAmt = (string) ($p['uiTokenAmount']['amount'] ?? '0');
        $gain = krmServicesBigIntSub($postAmt, $preAmt);
    }
    return $gain;
}

/**
 * Vérifie on-chain un paiement KRM TransferChecked.
 * @param bool $rejectIfUsed si true, refuse les signatures déjà liées à une demande
 */
function krmServicesVerifyPayment(array $input, bool $rejectIfUsed = true): array
{
    $signature = trim((string) ($input['signature'] ?? ''));
    $serviceId = trim((string) ($input['serviceId'] ?? ''));
    $userWallet = trim((string) ($input['userWallet'] ?? ''));
    $treasury = krmServicesTreasury();
    $catalog = krmServicesCatalog();

    $out = [
        'valid' => false,
        'signature' => $signature !== '' ? $signature : null,
        'paymentId' => $signature !== '' ? $signature : null,
        'serviceId' => $serviceId !== '' ? $serviceId : null,
        'amountKrm' => null,
        'payer' => $userWallet !== '' ? $userWallet : null,
        'treasury' => $treasury !== '' ? $treasury : null,
        'confirmedAt' => null,
        'error' => null,
    ];

    if ($treasury === '') {
        $out['error'] = 'TREASURY_MISSING';
        return $out;
    }
    if ($signature === '') {
        $out['error'] = 'SIGNATURE_MISSING';
        return $out;
    }
    if (!isset($catalog[$serviceId])) {
        $out['error'] = 'UNKNOWN_SERVICE';
        return $out;
    }
    if ($userWallet === '') {
        $out['error'] = 'WALLET_MISSING';
        return $out;
    }
    if ($rejectIfUsed && krmServicesPaymentHasRequest($signature)) {
        $out['error'] = 'PAYMENT_ALREADY_USED';
        return $out;
    }

    $service = $catalog[$serviceId];
    $expectedRaw = (string) $service['amountRaw'];
    $out['amountKrm'] = (int) $service['amountKrm'];

    try {
        $rpc = krmServicesHeliusRpc([
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'getTransaction',
            'params' => [
                $signature,
                [
                    'encoding' => 'jsonParsed',
                    'commitment' => 'confirmed',
                    'maxSupportedTransactionVersion' => 0,
                ],
            ],
        ]);
    } catch (Throwable $e) {
        $out['error'] = $e->getMessage() === 'RPC_FAILED' ? 'RPC_FAILED' : $e->getMessage();
        return $out;
    }

    $tx = $rpc['result'] ?? null;
    if (!$tx) {
        $out['error'] = 'TX_NOT_FOUND';
        return $out;
    }
    if (!empty($tx['meta']['err'])) {
        $out['error'] = 'TX_FAILED_ONCHAIN';
        return $out;
    }

    $matched = false;
    $errorHint = 'NO_MATCHING_TRANSFER';
    foreach (krmServicesCollectInstructions($tx) as $ix) {
        $parsed = $ix['parsed'] ?? null;
        if (!is_array($parsed) || ($parsed['type'] ?? '') !== 'transferChecked') {
            continue;
        }
        $info = $parsed['info'] ?? [];
        $tokenAmount = $info['tokenAmount'] ?? [];
        $mintOk = ($info['mint'] ?? '') === KRM_MINT_OFFICIAL;
        $amountOk = (string) ($tokenAmount['amount'] ?? '') === $expectedRaw;
        $decimalsOk = !isset($tokenAmount['decimals']) || (int) $tokenAmount['decimals'] === KRM_DECIMALS;
        $authority = (string) ($info['authority'] ?? '');
        $payerOk = $authority === $userWallet;
        $dest = (string) ($info['destination'] ?? '');
        $destOwnerOk = false;
        foreach ($tx['meta']['postTokenBalances'] ?? [] as $p) {
            if (($p['mint'] ?? '') !== KRM_MINT_OFFICIAL) {
                continue;
            }
            if (($p['owner'] ?? '') === $treasury) {
                $destOwnerOk = true;
            }
        }

        if ($mintOk && $amountOk && $decimalsOk && $payerOk && $destOwnerOk && $dest !== '') {
            $matched = true;
            break;
        }
        if (!$mintOk) {
            $errorHint = 'WRONG_MINT';
        } elseif (!$destOwnerOk) {
            $errorHint = 'WRONG_RECIPIENT';
        } elseif (!$amountOk) {
            $errorHint = 'WRONG_AMOUNT';
        } elseif (!$payerOk) {
            $errorHint = 'WRONG_PAYER';
        }
    }

    if (!$matched) {
        $out['error'] = $errorHint;
        return $out;
    }

    $gain = krmServicesTreasuryGainRaw($tx, $treasury);
    if ($gain !== null && $gain !== $expectedRaw) {
        $out['error'] = 'WRONG_AMOUNT';
        return $out;
    }

    $out['valid'] = true;
    $out['error'] = null;
    $out['confirmedAt'] = isset($tx['blockTime'])
        ? gmdate('c', (int) $tx['blockTime'])
        : gmdate('c');
    return $out;
}

/**
 * Enregistre un paiement validé (statut PAID) sans créer de demande.
 * Signature = paymentId.
 */
function krmServicesRegisterPaid(array $input): array
{
    $verification = krmServicesVerifyPayment($input, true);
    if (empty($verification['valid'])) {
        return [
            'ok' => false,
            'error' => $verification['error'] ?? 'VERIFY_FAILED',
            'verification' => $verification,
        ];
    }

    $signature = (string) $verification['signature'];
    $existing = krmServicesGetPayment($signature);
    if ($existing && !empty($existing['requestId'])) {
        return [
            'ok' => false,
            'error' => 'PAYMENT_ALREADY_USED',
            'payment' => $existing,
        ];
    }

    $payments = krmServicesReadJson(krmServicesPaymentsFile());
    $payments[$signature] = [
        'paymentId' => $signature,
        'signature' => $signature,
        'serviceId' => $verification['serviceId'],
        'userWallet' => $verification['payer'],
        'amountKrm' => $verification['amountKrm'],
        'treasury' => $verification['treasury'],
        'status' => KRM_STATUS_PAID,
        'requestId' => $existing['requestId'] ?? null,
        'verifiedAt' => $verification['confirmedAt'],
        'recordedAt' => $existing['recordedAt'] ?? gmdate('c'),
        'updatedAt' => gmdate('c'),
    ];
    krmServicesWriteJson(krmServicesPaymentsFile(), $payments);

    return [
        'ok' => true,
        'payment' => $payments[$signature],
        'verification' => $verification,
        'canCreateRequest' => empty($payments[$signature]['requestId']),
    ];
}

function krmServicesSubmitRequest(array $input): array
{
    $signature = trim((string) ($input['signature'] ?? ''));
    $serviceId = trim((string) ($input['serviceId'] ?? ''));
    $userWallet = trim((string) ($input['userWallet'] ?? ''));

    if ($signature === '' || $serviceId === '' || $userWallet === '') {
        return ['ok' => false, 'error' => 'MISSING_FIELDS'];
    }

    if (krmServicesPaymentHasRequest($signature)) {
        return ['ok' => false, 'error' => 'PAYMENT_ALREADY_USED'];
    }

    // Re-vérification on-chain obligatoire avant création de demande
    $verification = krmServicesVerifyPayment([
        'signature' => $signature,
        'serviceId' => $serviceId,
        'userWallet' => $userWallet,
    ], true);
    if (empty($verification['valid'])) {
        return [
            'ok' => false,
            'error' => $verification['error'] ?? 'VERIFY_FAILED',
            'verification' => $verification,
        ];
    }

    $asset = trim((string) ($input['asset'] ?? ''));
    $timeframe = trim((string) ($input['timeframe'] ?? ''));
    $description = trim((string) ($input['description'] ?? ''));
    if ($asset === '' || $timeframe === '' || $description === '') {
        return ['ok' => false, 'error' => 'MISSING_REQUEST_FIELDS'];
    }

    $requestId = bin2hex(random_bytes(16));
    $catalog = krmServicesCatalog();
    $now = gmdate('c');
    $request = [
        'id' => $requestId,
        'paymentId' => $signature,
        'serviceId' => $serviceId,
        'serviceName' => $catalog[$serviceId]['name'],
        'amountKrm' => $verification['amountKrm'],
        'userWallet' => $userWallet,
        'signature' => $signature,
        'status' => KRM_STATUS_SUBMITTED,
        'createdAt' => $now,
        'updatedAt' => $now,
        'payload' => [
            'asset' => $asset,
            'timeframe' => $timeframe,
            'description' => $description,
            'tradingViewUrl' => trim((string) ($input['tradingViewUrl'] ?? '')),
            'comment' => trim((string) ($input['comment'] ?? '')),
            // trade idea
            'direction' => trim((string) ($input['direction'] ?? '')),
            'entryLevel' => trim((string) ($input['entryLevel'] ?? '')),
            'invalidation' => trim((string) ($input['invalidation'] ?? '')),
            'target' => trim((string) ($input['target'] ?? '')),
            'reasoning' => trim((string) ($input['reasoning'] ?? '')),
            // debrief
            'entry' => trim((string) ($input['entry'] ?? '')),
            'exit' => trim((string) ($input['exit'] ?? '')),
            'result' => trim((string) ($input['result'] ?? '')),
            'justification' => trim((string) ($input['justification'] ?? '')),
            'assumedErrors' => trim((string) ($input['assumedErrors'] ?? '')),
            'mainQuestion' => trim((string) ($input['mainQuestion'] ?? '')),
            'correctionFocus' => trim((string) ($input['correctionFocus'] ?? '')),
        ],
        'statusHistory' => [
            ['status' => KRM_STATUS_PAID, 'at' => $verification['confirmedAt'] ?? $now, 'by' => 'system'],
            ['status' => KRM_STATUS_SUBMITTED, 'at' => $now, 'by' => 'user'],
        ],
    ];

    $requests = krmServicesReadJson(krmServicesRequestsFile());
    $requests[] = $request;
    krmServicesWriteJson(krmServicesRequestsFile(), $requests);

    $payments = krmServicesReadJson(krmServicesPaymentsFile());
    $payments[$signature] = [
        'paymentId' => $signature,
        'signature' => $signature,
        'serviceId' => $serviceId,
        'userWallet' => $userWallet,
        'amountKrm' => $verification['amountKrm'],
        'treasury' => $verification['treasury'],
        'status' => KRM_STATUS_SUBMITTED,
        'requestId' => $requestId,
        'verifiedAt' => $verification['confirmedAt'],
        'recordedAt' => $payments[$signature]['recordedAt'] ?? $now,
        'updatedAt' => $now,
    ];
    krmServicesWriteJson(krmServicesPaymentsFile(), $payments);

    return [
        'ok' => true,
        'requestId' => $requestId,
        'request' => $request,
        'verification' => $verification,
    ];
}

function krmServicesListByWallet(string $wallet): array
{
    $wallet = trim($wallet);
    if ($wallet === '') {
        return ['ok' => false, 'error' => 'WALLET_MISSING'];
    }
    $requests = krmServicesReadJson(krmServicesRequestsFile());
    $mine = array_values(array_filter($requests, static function ($r) use ($wallet) {
        return is_array($r) && (($r['userWallet'] ?? '') === $wallet);
    }));
    usort($mine, static function ($a, $b) {
        return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
    });
    return ['ok' => true, 'requests' => $mine];
}

function krmServicesFindRequest(string $requestId): ?array
{
    foreach (krmServicesReadJson(krmServicesRequestsFile()) as $r) {
        if (is_array($r) && ($r['id'] ?? '') === $requestId) {
            return $r;
        }
    }
    return null;
}

function krmServicesAssertAdminPin(string $pin): bool
{
    $expected = krmServicesAdminPin();
    if ($expected === '' || $expected === 'CHANGEZ_MOI') {
        return false;
    }
    return hash_equals($expected, trim($pin));
}

function krmServicesAdminList(string $pin): array
{
    if (!krmServicesAssertAdminPin($pin)) {
        return ['ok' => false, 'error' => 'UNAUTHORIZED'];
    }
    $requests = krmServicesReadJson(krmServicesRequestsFile());
    usort($requests, static function ($a, $b) {
        return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
    });
    return ['ok' => true, 'requests' => array_values($requests)];
}

function krmServicesAdminUpdateStatus(array $input): array
{
    $pin = (string) ($input['pin'] ?? '');
    $requestId = trim((string) ($input['requestId'] ?? ''));
    $newStatus = strtoupper(trim((string) ($input['status'] ?? '')));

    if (!krmServicesAssertAdminPin($pin)) {
        return ['ok' => false, 'error' => 'UNAUTHORIZED'];
    }
    if ($requestId === '' || !in_array($newStatus, krmServicesAllowedStatuses(), true)) {
        return ['ok' => false, 'error' => 'INVALID_STATUS'];
    }

    $requests = krmServicesReadJson(krmServicesRequestsFile());
    $found = false;
    foreach ($requests as &$r) {
        if (!is_array($r) || ($r['id'] ?? '') !== $requestId) {
            continue;
        }
        $found = true;
        $current = (string) ($r['status'] ?? '');
        $allowed = krmServicesAdminTransitions()[$current] ?? [];
        if (!in_array($newStatus, $allowed, true)) {
            return [
                'ok' => false,
                'error' => 'INVALID_TRANSITION',
                'from' => $current,
                'to' => $newStatus,
            ];
        }
        $r['status'] = $newStatus;
        $r['updatedAt'] = gmdate('c');
        $hist = $r['statusHistory'] ?? [];
        if (!is_array($hist)) {
            $hist = [];
        }
        $hist[] = ['status' => $newStatus, 'at' => $r['updatedAt'], 'by' => 'admin'];
        $r['statusHistory'] = $hist;
        $updated = $r;
        break;
    }
    unset($r);

    if (!$found) {
        return ['ok' => false, 'error' => 'NOT_FOUND'];
    }

    krmServicesWriteJson(krmServicesRequestsFile(), $requests);

    // Sync payment status if linked
    $sig = (string) ($updated['signature'] ?? '');
    if ($sig !== '') {
        $payments = krmServicesReadJson(krmServicesPaymentsFile());
        if (isset($payments[$sig])) {
            $payments[$sig]['status'] = $newStatus;
            $payments[$sig]['updatedAt'] = gmdate('c');
            krmServicesWriteJson(krmServicesPaymentsFile(), $payments);
        }
    }

    return ['ok' => true, 'request' => $updated];
}

/**
 * Helpers testables sans RPC (unit tests).
 */
function krmServicesSimulateVerifyRules(array $opts): array
{
    $out = ['valid' => false, 'error' => null];
    if (!empty($opts['noPayment'])) {
        $out['error'] = 'FORM_WITHOUT_PAYMENT';
        return $out;
    }
    if (!empty($opts['alreadyUsed'])) {
        $out['error'] = 'PAYMENT_ALREADY_USED';
        return $out;
    }
    if (!empty($opts['txFailed'])) {
        $out['error'] = 'TX_FAILED_ONCHAIN';
        return $out;
    }
    if (!empty($opts['wrongMint'])) {
        $out['error'] = 'WRONG_MINT';
        return $out;
    }
    if (!empty($opts['wrongTreasury'])) {
        $out['error'] = 'WRONG_RECIPIENT';
        return $out;
    }
    if (!empty($opts['wrongAmount'])) {
        $out['error'] = 'WRONG_AMOUNT';
        return $out;
    }
    $serviceId = (string) ($opts['serviceId'] ?? '');
    $catalog = krmServicesCatalog();
    if (!isset($catalog[$serviceId])) {
        $out['error'] = 'UNKNOWN_SERVICE';
        return $out;
    }
    $out['valid'] = true;
    $out['amountKrm'] = $catalog[$serviceId]['amountKrm'];
    $out['status'] = KRM_STATUS_PAID;
    return $out;
}

function krmServicesSimulateAdminTransition(string $from, string $to): array
{
    $allowed = krmServicesAdminTransitions()[$from] ?? [];
    if (!in_array($to, $allowed, true)) {
        return ['ok' => false, 'error' => 'INVALID_TRANSITION'];
    }
    return ['ok' => true, 'status' => $to];
}
