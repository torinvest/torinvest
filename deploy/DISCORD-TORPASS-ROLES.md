# Discord TorPass — rôles automatiques (KRM)

Ce flux est **séparé** du bot TradingView / macro (qui envoie des messages).
Ici : OAuth Discord + bot qui **assigne des rôles** selon le solde KRM.

## Prérequis Discord Developer Portal

1. https://discord.com/developers/applications → ton application (ou crée-en une)
2. **OAuth2 → General**
   - Redirects : `https://radar.torinvest-trading.com/api/discord-torpass.php?action=callback`
   - Note **Client ID** + **Client Secret**
3. **Bot**
   - Reset Token → copie **Bot Token**
   - Privileged : pas besoin de intents message pour les rôles
4. Invite le bot sur ton serveur avec permission **Manage Roles** :
   ```
   https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=268435456&scope=bot
   ```
5. Dans Discord (Mode développeur ON) :
   - Clic droit serveur → Copier l’identifiant → `discord_guild_id`
   - Crée 3 rôles : `TorPass Community`, `TorPass Academy`, `TorPass Pro`
   - **Important** : le rôle du bot doit être **au-dessus** de ces 3 rôles
   - Copie l’ID de chaque rôle

## config.local.php (VPS)

```php
'discord_torpass_enabled' => true,
'discord_bot_token' => 'TOKEN_BOT',
'discord_client_id' => 'CLIENT_ID',
'discord_client_secret' => 'CLIENT_SECRET',
'discord_guild_id' => 'ID_SERVEUR',
'discord_role_community' => 'ID_ROLE_COMMUNITY',
'discord_role_academy' => 'ID_ROLE_ACADEMY',
'discord_role_pro' => 'ID_ROLE_PRO',
'discord_oauth_redirect' => 'https://radar.torinvest-trading.com/api/discord-torpass.php?action=callback',
```

Puis déployer l’API :

```bash
# après merge, ou depuis la branche :
API_DIR="/var/www/torinvest/api"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/cursor/discord-torpass-roles-691a/api"
for f in discord-torpass.php discord-torpass-lib.php; do
  curl -fsSL -o "/tmp/$f" "$BASE/$f" && sudo mv "/tmp/$f" "$API_DIR/$f"
done
sudo chown www-data:www-data "$API_DIR"/discord-torpass*.php
```

Test :

```bash
curl -s 'https://radar.torinvest-trading.com/api/discord-torpass.php?action=status'
```

`"enabled": true` attendu.

## Parcours utilisateur (TorPass)

1. Wallet Phantom connecté, ≥ 100 KRM  
2. Clic **ACTIVER MON ACCÈS DISCORD**  
3. Signature Phantom (preuve wallet)  
4. Autorisation Discord  
5. Rôles appliqués :
   - ≥ 100 → Community  
   - ≥ 250 → Community + Academy  
   - ≥ 500 → Community + Academy + Pro  

## Note

Le bot signaux TradingView / macro **n’est pas modifié**.
Tu peux utiliser le **même** bot Discord (même token) s’il a déjà Manage Roles.
