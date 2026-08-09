<?php
/**
 * Vérification & stockage des paiements services KRM (TransferChecked).
 * Validation on-chain via getTransaction + postTokenBalances (owner Treasury).
 * Pas de private key. Signature = id unique anti double usage.
 */
declare(strict_types=1);

const KRM_MINT_OFFICIAL = 'Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA';
const KRM_DECIMALS = 6;

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
    $tmp = $path . '.tmp';
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        throw new RuntimeException('JSON_ENCODE_FAILED');
    }
    if (file_put_contents($tmp, $json, LOCK_EX) === false) {
        throw new RuntimeException('WRITE_FAILED');
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

function krmServicesPaymentAlreadyUsed(string $signature): bool
{
    $payments = krmServicesReadJson(krmServicesPaymentsFile());
    return isset($payments[$signature]);
}

function krmServicesMarkPaymentUsed(string $signature, array $meta): void
{
    $path = krmServicesPaymentsFile();
    $payments = krmServicesReadJson($path);
    if (isset($payments[$signature])) {
        throw new RuntimeException('PAYMENT_ALREADY_USED');
    }
    $payments[$signature] = $meta;
    krmServicesWriteJson($path, $payments);
}

/**
 * Collecte toutes les instructions parsées (top-level + inner).
 */
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

/**
 * Delta brut KRM reçu par le wallet treasury (owner), via postTokenBalances.
 */
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
        // bcmath optional — compare as strings of integers
        $gain = krmServicesBigIntSub($postAmt, $preAmt);
    }
    return $gain;
}

function krmServicesBigIntSub(string $a, string $b): string
{
    if (function_exists('bcsub')) {
        return bcsub($a, $b, 0);
    }
    // PHP 8.1+ has no native bigint for strings; use GMP if present
    if (function_exists('gmp_strval')) {
        return gmp_strval(gmp_sub($a, $b));
    }
    return (string) ((int) $a - (int) $b);
}

function krmServicesVerifyPayment(array $input): array
{
    $signature = trim((string) ($input['signature'] ?? ''));
    $serviceId = trim((string) ($input['serviceId'] ?? ''));
    $userWallet = trim((string) ($input['userWallet'] ?? ''));
    $treasury = krmServicesTreasury();
    $catalog = krmServicesCatalog();

    $out = [
        'valid' => false,
        'signature' => $signature !== '' ? $signature : null,
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
    if (krmServicesPaymentAlreadyUsed($signature)) {
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

        // Destination must be an ATA owned by treasury (postTokenBalances)
        $dest = (string) ($info['destination'] ?? '');
        $destOwnerOk = false;
        foreach ($tx['meta']['postTokenBalances'] ?? [] as $p) {
            if (($p['mint'] ?? '') !== KRM_MINT_OFFICIAL) {
                continue;
            }
            // Match by resolving account keys when possible; owner check is authoritative
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

function krmServicesSubmitRequest(array $input): array
{
    $signature = trim((string) ($input['signature'] ?? ''));
    $serviceId = trim((string) ($input['serviceId'] ?? ''));
    $userWallet = trim((string) ($input['userWallet'] ?? ''));

    if ($signature !== '' && krmServicesPaymentAlreadyUsed($signature)) {
        return [
            'ok' => false,
            'error' => 'PAYMENT_ALREADY_USED',
        ];
    }

    $verification = krmServicesVerifyPayment([
        'signature' => $signature,
        'serviceId' => $serviceId,
        'userWallet' => $userWallet,
    ]);
    if (empty($verification['valid'])) {
        return [
            'ok' => false,
            'error' => $verification['error'] ?? 'VERIFY_FAILED',
            'verification' => $verification,
        ];
    }

    $requestId = bin2hex(random_bytes(16));
    $catalog = krmServicesCatalog();
    $request = [
        'id' => $requestId,
        'serviceId' => $serviceId,
        'serviceName' => $catalog[$serviceId]['name'],
        'amountKrm' => $verification['amountKrm'],
        'userWallet' => $userWallet,
        'signature' => $signature,
        'createdAt' => gmdate('c'),
        'payload' => [
            'asset' => trim((string) ($input['asset'] ?? '')),
            'timeframe' => trim((string) ($input['timeframe'] ?? '')),
            'description' => trim((string) ($input['description'] ?? '')),
            'tradingViewUrl' => trim((string) ($input['tradingViewUrl'] ?? '')),
            'comment' => trim((string) ($input['comment'] ?? '')),
            'direction' => trim((string) ($input['direction'] ?? '')),
            'entryLevel' => trim((string) ($input['entryLevel'] ?? '')),
            'invalidation' => trim((string) ($input['invalidation'] ?? '')),
            'target' => trim((string) ($input['target'] ?? '')),
            'entry' => trim((string) ($input['entry'] ?? '')),
            'exit' => trim((string) ($input['exit'] ?? '')),
            'result' => trim((string) ($input['result'] ?? '')),
            'justification' => trim((string) ($input['justification'] ?? '')),
            'correctionFocus' => trim((string) ($input['correctionFocus'] ?? '')),
        ],
    ];

    $requests = krmServicesReadJson(krmServicesRequestsFile());
    $requests[] = $request;
    krmServicesWriteJson(krmServicesRequestsFile(), $requests);

    krmServicesMarkPaymentUsed($signature, [
        'serviceId' => $serviceId,
        'userWallet' => $userWallet,
        'amountKrm' => $verification['amountKrm'],
        'requestId' => $requestId,
        'confirmedAt' => $verification['confirmedAt'],
        'recordedAt' => gmdate('c'),
    ]);

    return [
        'ok' => true,
        'requestId' => $requestId,
        'verification' => $verification,
    ];
}
