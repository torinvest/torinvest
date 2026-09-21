# Vidéos formation — règles d’accès

## Interdit
- Servir le contenu payant via **`/media/:file` sans session** (fuite Premium).
- Monter `app.get('/course/videos/…')` **avant** le middleware login/Premium.
- **Embed YouTube / Vimeo publics** dans les modules Premium (téléchargeables hors session).

## Obligatoire
- URL unique : `/course/videos/<fichier>.mp4`
- Auth **dans** le handler (session + `subscribed`) **ou** middleware paywall **avant** la route.
- Codec navigateur : **H.264 + AAC** (`yuv420p`, `+faststart`).
- Lecteur HTML5 avec au minimum :
  - `controlslist="nodownload"`
  - `oncontextmenu="return false"`
  - classe `forge-lesson-video--protected` + CSS `/css/forge-lesson-video.css`
- Fichier présent sous `private/course/videos/` **et** `public/course/videos/` (sync).

## Si la source est YouTube
1. Télécharger une fois sur le VPS (`yt-dlp` + `ffmpeg` H.264).
2. Stocker en `/course/videos/….mp4` (jamais d’iframe YouTube dans la leçon).
3. Brancher le `<video>` protégé (voir `DEPLOY-MODULE0-VIDEO2-PROTECTED.sh`).

## Vérif VPS
```bash
# Doit rediriger sans cookie
curl -sI https://app.torinvest-trading.com/course/videos/module-0-socle.mp4 | head -5
curl -sI https://app.torinvest-trading.com/course/videos/module-0-metier.mp4 | head -5

# Ne doit PAS exister en public
curl -sI https://app.torinvest-trading.com/media/module-0-socle.mp4 | head -5
# → 404 attendu
```

Si une ancienne route `/media` est dans `server.js`, la retirer puis `pm2 restart la-forge`.
