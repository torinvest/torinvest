# TORINVEST Macro Edge — SMT Monitor (MVP V1 Gold Desk)

Dashboard pédagogique Premium : régime macro or / dollar / taux, corrélations, SMT, alertes.

> « Le fondamental explique pourquoi ; la technique décide quand. »

## Accès

- URL : `https://app.torinvest-trading.com/macro-edge.html`
- Auth : session formation + `subscribed` (même gate que les autres modules Premium)
- Pas d’ordres automatiques ; disclaimer pédagogique en bas de page

## Déploiement VPS

```bash
REF=cursor/macro-edge-smt-mvp-691a curl -fsSL \
  "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-MACRO-EDGE.sh" \
  -o /tmp/d-me.sh && REF=cursor/macro-edge-smt-mvp-691a bash /tmp/d-me.sh
```

### Variable d’environnement (optionnelle)

| Variable | Rôle |
|----------|------|
| `FRED_API_KEY` | Séries FRED gratuites (DXY proxy, US02Y, US10Y, REAL10Y, BE10Y). Sans clé → fallback DEMO pour ces séries. |
| `FORGE_ADMIN_EMAILS` | Accès `PUT /api/macro-edge/config` et historique |

XAUUSD / XAGUSD : Stooq daily (gratuit, sans clé). Si Stooq échoue → DEMO clairement labellisé.

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/macro-edge/snapshot` | Snapshot Gold Desk complet |
| `GET /api/macro-edge/explain` | Synthèse FR « Explique-moi le marché » |
| `GET /api/macro-edge/series` | OHLC / closes |
| `GET /api/macro-edge/config` | Config (admin = complète) |
| `PUT /api/macro-edge/config` | Pondérations / seuils (admin) |
| `POST /api/macro-edge/refresh` | Invalide cache (admin) |

## MVP V1 inclus

1. Récupération données (FRED / Stooq / demo)
2. Matrice de corrélation (Pearson sur returns)
3. SMT XAU/XAG + divergences XAU/DXY + XAU/Real Yield
4. Macro SMT Gold
5. Gold Driver + USD Driver
6. US Rate Decomposition
7. Alertes de régime
8. Interface Gold Desk + Explique-moi le marché

## Roadmap

- **V2** : FX + Central Bank Watch + différentiels
- **V3** : News + NLP (sources obligatoires)
- **V4** : Backtest SMT (architecture history JSONL déjà en place)

## Tests

```bash
node deploy/vps/tests/test-macro-edge.js
```
