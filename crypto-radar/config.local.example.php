<?php
/**
 * Copiez en config.local.php (jamais commité sur Git).
 * VPS : /var/www/torinvest/crypto-radar/config.local.php
 */
return [
    // Clés Mistral AI — console.mistral.ai → API keys
    // Une clé suffit ; plusieurs clés = rotation automatique si quota dépassé
    'mistral_api_keys' => [
        'VOTRE_CLE_MISTRAL_ICI',
    ],

    // Optionnel : CoinGecko Pro (sinon API publique gratuite, limitée)
    // 'coingecko_api_key' => '',
];
