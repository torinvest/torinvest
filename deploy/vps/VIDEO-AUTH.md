# Vidéos formation — règles d’accès

## Interdit
- Servir le contenu payant via **`/media/:file` sans session** (fuite Premium).
- Monter `app.get('/course/videos/…')` **avant** le middleware login/Premium.

## Obligatoire
- URL unique : `/course/videos/<fichier>.mp4`
- Auth **dans** le handler (session + `subscribed`) **ou** middleware paywall **avant** la route.
- Codec navigateur : **H.264 + AAC** (`yuv420p`, `+faststart`).

## Vérif VPS
```bash
# Doit rediriger sans cookie
curl -sI https://app.torinvest-trading.com/course/videos/module-0-socle.mp4 | head -5

# Ne doit PAS exister en public
curl -sI https://app.torinvest-trading.com/media/module-0-socle.mp4 | head -5
# → 404 attendu
```

Si une ancienne route `/media` est dans `server.js`, la retirer puis `pm2 restart la-forge`.
