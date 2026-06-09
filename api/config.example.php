<?php
/**
 * Copiez ce fichier en config.local.php et renseignez vos valeurs.
 * config.local.php est ignoré par Git et ne doit jamais être commité.
 */
return [
    // Clé API Helius pour le proxy RPC Solana (lecture soldes KRM/ORAX)
    'helius_api_key' => 'VOTRE_CLE_HELIUS_ICI',

    // Code PIN personnel pour accéder à AITORINVEST2.html (page dev sans licence)
    'dev_access_pin' => 'CHANGEZ_MOI',

    // Durée de validité de la session dev (en secondes) — 7 jours par défaut
    'dev_session_ttl' => 604800,
];
