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

    // Token admin Worker (Cloudflare → wrangler secret put ADMIN_TOKEN)
    // Usage : /news/update, /discord/report, /telegram/test, /killswitch — PAS TradingView
    'admin_token' => 'VOTRE_ADMIN_TOKEN_WORKER',

    // MARKET_SECRET = wrangler secret put MARKET_SECRET — pour webhooks TradingView (/market/update)

    // Token Worker (signaux / agent / health) — serveur radar uniquement, jamais dans le JS public
    // wrangler secret put COPY_TOKEN + EA MT5 CopyToken
    'copy_token' => 'TOR_COPY_…',

    // URL du Worker (inchangé si morning-hall-d8f6)
    'worker_url' => 'https://morning-hall-d8f6.onzerimes.workers.dev',

    // Session CRM (secondes) — 12 h par défaut ; cookie HttpOnly torinvest_admin_licence
    'licence_crm_session_ttl' => 43200,

    // --- Provision automatique (formulaires activation) ---
    // false en prod : licence créée uniquement par webhook Stripe
    'allow_form_provision' => false,
    // Secret optionnel pour webhook Netlify (header X-Provision-Key)
    'provision_webhook_secret' => '',

    // Webhook Discord admin — alerte à chaque formulaire activation traité
    'provision_notify_discord_webhook' => '',

    // Si true + secret défini : seul le webhook Netlify peut provisionner (navigateur bloqué)
    'require_webhook_provision' => true,

    // Liens accès accompagnement (publics — affichés après validation licence)
    'discord_public_url' => 'https://discord.gg/5mSC8gFsT7',
    'discord_accompagnement_url' => 'https://discord.gg/5mSC8gFsT7',
    'telegram_public_url' => 'https://t.me/+2qMkEX3KnhowNTU0',
    'telegram_vip_url' => 'https://t.me/+2qMkEX3KnhowNTU0',
    'app_formation_login_url' => 'https://app.torinvest-trading.com/login.html',

    // --- Stripe webhook (paiement confirmé → licence) ---
    // Dashboard Stripe → Developers → Webhooks → signing secret (whsec_…)
    'stripe_webhook_secret' => '',

    // Slugs Payment Links (buy.stripe.com/XXXX) — repli si metadata absente
    'stripe_payment_link_vip_slugs' => ['28E28rbhpdqn5si827d7q00'],
    'stripe_payment_link_accompagnement_slugs' => ['aFabJ10CLeurf2S827d7q01'],

    // IDs Payment Link Stripe (plink_…) — prioritaire si renseignés
    'stripe_payment_link_vip_ids' => [],
    'stripe_payment_link_accompagnement_ids' => [],

    // IDs Price Stripe (price_…) — si line_items présents dans le webhook
    'stripe_price_vip_ids' => [],
    'stripe_price_accompagnement_ids' => [],

    // Montants en centimes EUR (repli ultime)
    'stripe_vip_amounts' => [7900],
    'stripe_accompagnement_amounts' => [34900],
    'stripe_vip_days' => 30,
    'stripe_accompagnement_days' => 365,

    // Metadata Payment Link recommandée : torinvest_plan = vip | accompagnement

    // --- Brevo (contacts + emails transactionnels) ---
    'brevo_api_key' => '',
    'brevo_list_accompagnement' => 9,
    'brevo_list_vip' => 10,
    'brevo_list_waitlist' => 5,
    'brevo_sender_email' => 'contact@torinvest-trading.com',
    'brevo_sender_name' => 'TORINVEST',
    // 0 = email HTML intégré ; sinon ID template Brevo transactionnel
    'brevo_template_vip' => 0,
    'brevo_template_accompagnement' => 0,
];
