# TradingView → Worker TORINVEST

## Important : MARKET_SECRET ≠ ADMIN_TOKEN

| Secret | Route | Usage |
|--------|-------|--------|
| **MARKET_SECRET** | `POST /market/update` ou `/tv/webhook` | **Indicateurs TradingView** (prix, macro, MTF…) |
| **ADMIN_TOKEN** | `/news/update`, `/discord/report`, `/telegram/test`, `/killswitch` | **Toi / crons admin** — pas TradingView |

---

## TradingView — où mettre MARKET_SECRET

Dans le **message d’alerte webhook** (JSON), ajoute le champ `"secret"` :

```json
{
  "secret": "VOTRE_MARKET_SECRET_ICI",
  "symbol": "{{ticker}}",
  "price": {{close}},
  "source": "TradingView",
  "tf": "{{interval}}"
}
```

Alternative : header HTTP (si ton script alerte le supporte) :

```
Authorization: Bearer VOTRE_MARKET_SECRET
```

URL webhook :

```
https://morning-hall-d8f6.onzerimes.workers.dev/market/update
```

---

## Pine Script — exemple (alerte)

Si tu construis le JSON dans Pine v6 :

```pine
marketSecret = input.string("", "MARKET_SECRET", group="Worker")
payload = '{"secret":"' + marketSecret + '","symbol":"' + syminfo.ticker + '","price":' + str.tostring(close) + ',"source":"TradingView","tf":"' + timeframe.period + '"}'
// alert(payload, alert.freq_once_per_bar_close)
```

Colle la **même valeur** que `npx wrangler secret list` → MARKET_SECRET.

---

## ADMIN_TOKEN — quand l’utiliser

Uniquement si **tu** appelles manuellement ou via cron Cloudflare :

```
GET https://morning-hall-d8f6.onzerimes.workers.dev/news/update?secret=VOTRE_ADMIN_TOKEN
GET https://morning-hall-d8f6.onzerimes.workers.dev/discord/report?secret=VOTRE_ADMIN_TOKEN
```

**Ne mets pas ADMIN_TOKEN dans TradingView.**
