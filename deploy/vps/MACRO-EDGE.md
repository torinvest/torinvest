# TORINVEST Macro Edge — SMT Monitor (Gold Desk + FX Desk)

Dashboard pédagogique Premium : régime macro or / dollar / taux / FX, banques centrales, corrélations, SMT, alertes.

> « Le fondamental explique pourquoi ; la technique décide quand. »

## Accès

- URL : `https://app.torinvest-trading.com/macro-edge.html`
- Auth : session formation + `subscribed` (même gate que les autres modules Premium)
- Onglets : **GOLD DESK** · **FX DESK**
- Pas d’ordres automatiques ; disclaimer pédagogique en bas de page

## Déploiement VPS

```bash
REF=cursor/macro-edge-fx-desk-691a curl -fsSL \
  "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-MACRO-EDGE.sh" \
  -o /tmp/d-me.sh && REF=cursor/macro-edge-fx-desk-691a bash /tmp/d-me.sh
```

### Si nginx renvoie **502 Bad Gateway** (site entier down)

```bash
curl -fsSL \
  "https://raw.githubusercontent.com/torinvest/torinvest/cursor/hotfix-macro-edge-502-691a/deploy/vps/HOTFIX-MACRO-EDGE-502.sh" \
  -o /tmp/hotfix-me-502.sh && bash /tmp/hotfix-me-502.sh
```

> ⚠️ Ne pas écrire `REF=... curl "...${REF}..."` : bash développe `${REF}` **avant** l’assignment → URL vide → **404**.

Cause fréquente : `engine.js` charge `centralBanks.js` / `policyDifferentials.js` absents, ou `server.js` corrompu par le wire → PM2 crash loop.

### Variables d’environnement

| Variable | Rôle |
|----------|------|
| `FRED_API_KEY` | Séries FRED (yields, Gold Desk DXY proxy DTWEXBGS). Sans clé → fallback DEMO pour ces séries. |
| `FORGE_WORKER_URL` | Worker TORINVEST (défaut `https://morning-hall-d8f6.onzerimes.workers.dev`) — métaux + FX + DXY via `/market/blocks`. |
| `FORGE_ADMIN_EMAILS` | Accès `PUT /api/macro-edge/config` (dont scores banques centrales) |

**Gold Desk** : XAU/XAG Worker · DXY FRED TWI · yields/breakeven FRED.

**FX Desk** : paires FX Worker · **DXY Worker** (≠ FRED Gold Desk) · yields FRED · Central Bank Watch + différentiels.

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/macro-edge/snapshot?desk=gold\|fx` | Snapshot Gold ou FX |
| `GET /api/macro-edge/explain?desk=gold\|fx` | Synthèse FR « Explique-moi le marché » |
| `GET /api/macro-edge/series?desk=gold\|fx` | OHLC / closes |
| `GET /api/macro-edge/config` | Config (admin = complète, dont `centralBanks`) |
| `PUT /api/macro-edge/config` | Pondérations / seuils / biais BC (admin) |
| `POST /api/macro-edge/refresh` | Invalide cache (admin) |

## Inclus

### Gold Desk
1. Drivers USD / Gold / Inflation + US Rate Decomposition
2. Corrélations, SMT XAU/XAG–DXY–Real, Macro SMT Gold
3. Alertes de régime or

### FX Desk (V2)
1. Drivers USD / EUR / Risk (AUD-NZD) / Policy Spread
2. Central Bank Watch (scores −3…+3 configurables admin — pas de news auto)
3. Différentiels monétaires (« avantage relatif », jamais un call de trade)
4. Corrélations FX + SMT EUR/GBP, AUD/NZD, EURJPY/USDJPY
5. Alertes dollar / breakdown corr / déconnexion policy-prix / SMT

## Roadmap

- **V3** : News + NLP (sources obligatoires URL + date)
- **V4** : Backtest SMT (history JSONL déjà en place)

## Tests

```bash
node deploy/vps/tests/test-macro-edge.js
```
