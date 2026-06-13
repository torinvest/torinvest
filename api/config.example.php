<?php
/**
 * Copiez ce fichier en config.local.php et renseignez vos valeurs.
 * config.local.php est ignoré par Git et ne doit jamais être commité.
 */
return [
    // Clé API Helius pour le proxy RPC Solana (lecture soldes KRM/ORAX)
    'helius_api_key' => 'VOTRE_CLE_HELIUS_ICI',

    // Code PIN personnel — accès admin AI Access (onglet Admin sur ai-access.html)
    'dev_access_pin' => 'CHANGEZ_MOI',

    // Durée session admin (secondes) — 7 jours par défaut
    'dev_session_ttl' => 604800,

    // --- AI Access sécurisé (AITORINVEST.html) ---
    // Secret HMAC sessions (laisser vide = dérivé des PIN ci-dessus)
    'ai_access_hmac_secret' => '',

    // Session client licence (secondes) — 12 h
    'ai_access_client_session_ttl' => 43200,

    // Session admin (secondes) — reprend dev_session_ttl si absent
    'ai_access_admin_session_ttl' => 604800,

    // Limite requêtes /ai/chat via proxy (par heure)
    'ai_access_chat_rate_client' => 80,
    'ai_access_chat_rate_admin' => 300,

    // Secret partagé radar ↔ Worker (POST /ai/chat, /ai/research) — même valeur que wrangler secret AI_CHAT_SECRET
    'ai_chat_secret' => 'CHANGEZ_MOI_LONG_RANDOM',
    // Repli optionnel si ai_chat_secret vide (ex. réutiliser AI_DECISION_SECRET Worker)
    'ai_decision_secret' => '',

    // --- CRM admin-licence (gestion licences VIP + FORGE) ---
    // PIN d'accès à la page /admin-licence/ (distinct du dev_access_pin)
    'licence_crm_pin' => 'CHANGEZ_MOI_CRM',

    // Token admin Worker (Cloudflare → Settings → Variables → ADMIN_TOKEN)
    'admin_token' => 'VOTRE_ADMIN_TOKEN_WORKER',

    // Token Worker (signaux / agent / health) — serveur radar uniquement, jamais dans le JS public
    // wrangler secret put COPY_TOKEN + EA MT5 CopyToken
    'copy_token' => 'TOR_COPY_…',

    // URL du Worker (inchangé si morning-hall-d8f6)
    'worker_url' => 'https://morning-hall-d8f6.onzerimes.workers.dev',

    // Session CRM (secondes) — 12 h par défaut ; cookie HttpOnly torinvest_admin_licence
    'licence_crm_session_ttl' => 43200,
];
