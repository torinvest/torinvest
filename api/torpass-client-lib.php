<?php
/**
 * TorPass client — liens Discord + statut abonnements € (liés au wallet).
 * Ne touche pas aux paiements KRM TransferChecked.
 */
declare(strict_types=1);

require_once __DIR__ . '/admin-licence-lib.php';
require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/ai-access-lib.php';

function torpassClientPublicLicenseSummary(?array $row): ?array
{
    if ($row === null) {
        return null;
    }
    $type = strtoupper(trim((string) ($row['type'] ?? '')));
    $offer = null;
    if ($type === 'VIP') {
        $offer = 'ROBOT';
    } elseif ($type === 'ACCOMPAGNEMENT') {
        $offer = 'FORMATION';
    }
    return [
        'offer' => $offer,
        'type' => $type,
        'status' => (string) ($row['status'] ?? ''),
        'expiresAt' => (string) ($row['expires_at'] ?? ''),
        'licenseHint' => torpassClientLicenseHint((string) ($row['license_code'] ?? '')),
    ];
}

function torpassClientLicenseHint(string $license): string
{
    $license = trim($license);
    if (strlen($license) < 8) {
        return '••••';
    }
    return substr($license, 0, 4) . '…' . substr($license, -4);
}

function torpassClientSubscriptionsFromRows(array $rows): array
{
    $robot = null;
    $formation = null;
    foreach ($rows as $row) {
        $type = strtoupper(trim((string) ($row['type'] ?? '')));
        if ($type === 'VIP' && $robot === null) {
            $robot = $row;
        }
        if ($type === 'ACCOMPAGNEMENT' && $formation === null) {
            $formation = $row;
        }
    }
    return [
        'formationActive' => $formation !== null,
        'robotActive' => $robot !== null,
        'formation' => torpassClientPublicLicenseSummary($formation),
        'robot' => torpassClientPublicLicenseSummary($robot),
        'source' => 'licence_crm',
    ];
}

function torpassClientStatusForWallet(string $wallet): array
{
    $wallet = trim($wallet);
    if ($wallet === '' || strlen($wallet) < 32) {
        throw new InvalidArgumentException('wallet_invalide');
    }
    $rows = licenceCrmListUsableByWallet($wallet);
    $subs = torpassClientSubscriptionsFromRows($rows);
    $links = licenceCrmAccessLinks();
    return [
        'ok' => true,
        'wallet' => $wallet,
        'formationActive' => $subs['formationActive'],
        'robotActive' => $subs['robotActive'],
        'formation' => $subs['formation'],
        'robot' => $subs['robot'],
        'source' => $subs['source'],
        'discordInviteUrl' => (string) ($links['discordPublic'] ?? ''),
        'discordNote' =>
            'Accès Discord privé éligible selon ton niveau TorPass. ' .
            'Le rôle Discord n’est pas encore attribué automatiquement — rejoins le serveur via l’invite.',
    ];
}

/**
 * Vérifie une licence CRM (et Worker pour VIP si possible), puis lie le wallet.
 */
function torpassClientLinkLicense(string $wallet, string $licenseKey, string $email = ''): array
{
    torinvestRateLimitGuard('torpass_link_license', 12, 900);

    $wallet = trim($wallet);
    $licenseKey = trim($licenseKey);
    $email = strtolower(trim($email));

    if ($wallet === '' || strlen($wallet) < 32) {
        torinvestRateLimitHit('torpass_link_license');
        throw new InvalidArgumentException('wallet_invalide');
    }
    if ($licenseKey === '') {
        torinvestRateLimitHit('torpass_link_license');
        throw new InvalidArgumentException('licence_obligatoire');
    }

    $row = licenceCrmFindByLicenseCode($licenseKey);
    $workerMeta = null;

    // Fallback Worker : utile si la licence VIP existe côté Worker mais pas encore en CRM local
    if ($row === null) {
        try {
            $query = ['key' => $licenseKey];
            if ($email !== '') {
                $query['email'] = $email;
            }
            $workerMeta = aiAccessWorkerGet('/validate-license', $query);
            if (empty($workerMeta['ok'])) {
                torinvestRateLimitHit('torpass_link_license');
                throw new RuntimeException('licence_invalide');
            }
        } catch (Throwable $e) {
            torinvestRateLimitHit('torpass_link_license');
            throw new RuntimeException('licence_introuvable');
        }

        $plan = strtoupper(trim((string) ($workerMeta['plan'] ?? '')));
        $type = 'VIP';
        if ($plan === 'ACCOMPAGNEMENT' || str_starts_with($plan, 'ACCOMP')) {
            $type = 'ACCOMPAGNEMENT';
        } elseif (($workerMeta['canTrade'] ?? false) === true || $plan === 'VIP' || str_starts_with($plan, 'VIP')) {
            $type = 'VIP';
        } else {
            // Accompagnement worker sans canTrade
            if ($email !== '') {
                $type = 'ACCOMPAGNEMENT';
            }
        }

        // Enregistrement local minimal pour TorPass (pas de private key)
        licenceCrmInsertRecord([
            'type' => $type,
            'created_at' => gmdate('c'),
            'email' => $email !== '' ? $email : (string) ($workerMeta['email'] ?? ''),
            'wallet' => $wallet,
            'license_code' => $licenseKey,
            'plan' => $plan !== '' ? $plan : $type,
            'expires_at' => (string) ($workerMeta['expires'] ?? ''),
            'status' => (string) ($workerMeta['status'] ?? 'active'),
            'notes' => 'linked_via_torpass',
            'worker_response' => json_encode($workerMeta, JSON_UNESCAPED_UNICODE),
        ]);
        $row = licenceCrmFindByLicenseCode($licenseKey);
    }

    if ($row === null) {
        torinvestRateLimitHit('torpass_link_license');
        throw new RuntimeException('licence_introuvable');
    }

    $type = strtoupper(trim((string) ($row['type'] ?? '')));
    if ($type !== 'VIP' && $type !== 'ACCOMPAGNEMENT') {
        torinvestRateLimitHit('torpass_link_license');
        throw new RuntimeException('licence_type_non_supporté');
    }

    if ($type === 'ACCOMPAGNEMENT' && $email !== '') {
        $rowEmail = strtolower(trim((string) ($row['email'] ?? '')));
        if ($rowEmail !== '' && $rowEmail !== $email) {
            torinvestRateLimitHit('torpass_link_license');
            throw new RuntimeException('email_ne_correspond_pas');
        }
    }

    if (!licenceCrmRecordIsUsable($row)) {
        torinvestRateLimitHit('torpass_link_license');
        throw new RuntimeException('licence_expiree');
    }

    $status = strtolower(trim((string) ($row['status'] ?? '')));
    if (!in_array($status, ['active', 'reused', 'pending_activation'], true)) {
        torinvestRateLimitHit('torpass_link_license');
        throw new RuntimeException('licence_inactive');
    }

    try {
        $attach = licenceCrmAttachWalletToLicense($licenseKey, $wallet);
    } catch (Throwable $e) {
        torinvestRateLimitHit('torpass_link_license');
        throw $e;
    }

    $statusPayload = torpassClientStatusForWallet($wallet);
    $offer = $type === 'VIP' ? 'ROBOT' : 'FORMATION';

    return [
        'ok' => true,
        'linked' => !empty($attach['linked']),
        'already' => !empty($attach['already']),
        'offer' => $offer,
        'type' => $type,
        'formationActive' => $statusPayload['formationActive'],
        'robotActive' => $statusPayload['robotActive'],
        'formation' => $statusPayload['formation'],
        'robot' => $statusPayload['robot'],
        'message' =>
            $offer === 'ROBOT'
                ? 'Robot Access lié à ce wallet.'
                : 'Formation Trading liée à ce wallet.',
    ];
}
