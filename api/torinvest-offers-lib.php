<?php
/**
 * Offres commerciales TORINVEST + modes de pricing (miroir serveur).
 * Source JS : assets/torinvest-offers-config.js
 *
 * Règle abonnements € :
 * - Vérifier KRM uniquement à l’achat / renouvellement (MEMBER_PRICING).
 * - Ne JAMAIS révoquer une licence déjà payée si le solde KRM baisse ensuite.
 */
declare(strict_types=1);

function torinvestOffersConfig(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $file = __DIR__ . '/config.local.php';
    $local = [];
    if (is_file($file)) {
        $loaded = require $file;
        $local = is_array($loaded) ? $loaded : [];
    }

    $levels = [
        'PUBLIC' => 0,
        'COMMUNITY' => 100,
        'ACADEMY' => 250,
        'PRO' => 500,
        'COACHING' => 500, // alias
    ];

    $cfg = [
        'pricing_mode' => (string) ($local['pricing_mode'] ?? 'PUBLIC_PROMO'),
        'torpass_levels' => $levels,
        'offers' => [
            'ROBOT' => [
                'id' => 'ROBOT',
                'name' => 'Robot Access',
                'regular_price' => (float) ($local['robot_regular_price'] ?? 149),
                'promo_price' => (float) ($local['robot_promo_price'] ?? 79),
                'member_price' => (float) ($local['robot_member_price'] ?? 79),
                'required_krm_level' => 'PRO',
                'required_krm' => 500,
                'licence_type' => 'VIP',
            ],
            'FORMATION' => [
                'id' => 'FORMATION',
                'name' => 'Formation Trading',
                'regular_price' => (float) ($local['formation_regular_price'] ?? 499),
                'promo_price' => (float) ($local['formation_promo_price'] ?? 349),
                'member_price' => (float) ($local['formation_member_price'] ?? 349),
                'required_krm_level' => 'ACADEMY',
                'required_krm' => 250,
                'licence_type' => 'ACCOMPAGNEMENT',
            ],
        ],
    ];
    return $cfg;
}

function torinvestOffersLevelFromBalance(float $krmBalance): string
{
    $levels = torinvestOffersConfig()['torpass_levels'];
    if ($krmBalance + 1e-9 >= (float) $levels['PRO']) {
        return 'PRO';
    }
    if ($krmBalance + 1e-9 >= (float) $levels['ACADEMY']) {
        return 'ACADEMY';
    }
    if ($krmBalance + 1e-9 >= (float) $levels['COMMUNITY']) {
        return 'COMMUNITY';
    }
    return 'PUBLIC';
}

function torinvestOffersLevelRank(string $level): int
{
    $map = [
        'PUBLIC' => 0,
        'COMMUNITY' => 1,
        'ACADEMY' => 2,
        'PRO' => 3,
        'COACHING' => 3,
    ];
    return $map[$level] ?? 0;
}

/**
 * Prix applicable pour affichage / checkout.
 * @return array{ok:bool,display_price?:float,compare_at?:?float,krm_required_now?:bool,badge?:string,mode?:string}
 */
function torinvestOffersResolvePrice(string $offerId, ?string $torpassLevel = null): array
{
    $cfg = torinvestOffersConfig();
    $offer = $cfg['offers'][$offerId] ?? null;
    if ($offer === null) {
        return ['ok' => false, 'error' => 'UNKNOWN_OFFER'];
    }
    $mode = $cfg['pricing_mode'];
    $level = $torpassLevel ?: 'PUBLIC';
    $memberOk = torinvestOffersLevelRank($level) >= torinvestOffersLevelRank((string) $offer['required_krm_level']);

    if ($mode === 'PUBLIC_PROMO') {
        return [
            'ok' => true,
            'mode' => $mode,
            'display_price' => (float) $offer['promo_price'],
            'compare_at' => (float) $offer['regular_price'],
            'krm_required_now' => false,
            'member_eligible' => $memberOk,
            'badge' => 'OFFRE DE LANCEMENT — aucun KRM requis',
        ];
    }
    if ($mode === 'MEMBER_PRICING') {
        if ($memberOk) {
            return [
                'ok' => true,
                'mode' => $mode,
                'display_price' => (float) $offer['member_price'],
                'compare_at' => (float) $offer['regular_price'],
                'krm_required_now' => true,
                'member_eligible' => true,
                'badge' => 'Tarif membre ' . $offer['required_krm_level'],
            ];
        }
        return [
            'ok' => true,
            'mode' => $mode,
            'display_price' => (float) $offer['regular_price'],
            'compare_at' => null,
            'krm_required_now' => false,
            'member_eligible' => false,
            'badge' => 'Tarif public',
        ];
    }
    return [
        'ok' => true,
        'mode' => $mode,
        'display_price' => (float) $offer['regular_price'],
        'compare_at' => null,
        'krm_required_now' => false,
        'member_eligible' => $memberOk,
        'badge' => 'Tarif normal',
    ];
}

/**
 * À appeler UNIQUEMENT à l’achat / renouvellement (pas en ping quotidien).
 * Si eligible + MEMBER_PRICING : le tarif membre peut être appliqué.
 * Après paiement réussi : conserver expires_at licence sans re-check KRM quotidien.
 *
 * @param array{offer_id:string,krm_balance:float,wallet?:string} $input
 */
function torinvestOffersCheckoutKrmGate(array $input): array
{
    $offerId = (string) ($input['offer_id'] ?? '');
    $bal = (float) ($input['krm_balance'] ?? 0);
    $cfg = torinvestOffersConfig();
    $offer = $cfg['offers'][$offerId] ?? null;
    if ($offer === null) {
        return ['ok' => false, 'eligible' => false, 'error' => 'UNKNOWN_OFFER'];
    }
    $mode = $cfg['pricing_mode'];
    $level = torinvestOffersLevelFromBalance($bal);

    if ($mode === 'PUBLIC_PROMO') {
        return [
            'ok' => true,
            'eligible' => true,
            'krm_required' => false,
            'reason' => 'PUBLIC_PROMO',
            'level' => $level,
            'note' => 'Promo publique — aucun KRM requis. Ne pas révoquer après paiement.',
        ];
    }
    if ($mode !== 'MEMBER_PRICING') {
        return [
            'ok' => true,
            'eligible' => false,
            'krm_required' => false,
            'reason' => 'MEMBER_PRICING_OFF',
            'level' => $level,
        ];
    }
    $eligible = torinvestOffersLevelRank($level) >= torinvestOffersLevelRank((string) $offer['required_krm_level']);
    return [
        'ok' => true,
        'eligible' => $eligible,
        'krm_required' => true,
        'reason' => $eligible ? 'MEMBER_OK' : 'INSUFFICIENT_KRM',
        'level' => $level,
        'required_krm' => (float) $offer['required_krm'],
        'required_krm_level' => $offer['required_krm_level'],
        'balance' => $bal,
        'note' => 'Si paiement membre réussi : garder licence jusqu’à expires_at même si KRM baisse. Re-vérifier seulement au renouvellement.',
    ];
}
