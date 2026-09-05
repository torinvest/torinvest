#!/usr/bin/env bash
# Diagnostic Module 0 vidéo — à lancer sur le VPS
set -euo pipefail
APP="${1:-$HOME/torinvest-formation}"
PORT="${PORT:-3001}"
FILE_PRIV="$APP/private/course/videos/module-0-socle.mp4"
FILE_PUB="$APP/public/course/videos/module-0-socle.mp4"

echo "== Fichiers =="
ls -lh "$FILE_PRIV" "$FILE_PUB" 2>&1 || true

echo
echo "== Codec (si ffprobe dispo) =="
if command -v ffprobe >/dev/null 2>&1; then
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "$FILE_PRIV" || true
  ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$FILE_PRIV" || true
else
  echo "ffprobe absent — install: sudo apt-get install -y ffmpeg"
fi

echo
echo "== Route dans server.js =="
grep -n "COURSE_VIDEOS\|/course/videos" "$APP/server.js" | head -20 || true

echo
echo "== curl local SANS cookie (attendu 302) =="
curl -sI "http://127.0.0.1:${PORT}/course/videos/module-0-socle.mp4" | head -12

echo
echo "== curl local AVEC cookie session (colle ton cookie ci-dessous) =="
echo "1) Dans Chrome (connecté) : F12 → Application → Cookies → copie la valeur du cookie de session"
echo "2) Relance:"
echo "   COOKIE='connect.sid=XXXX' bash $0"
if [[ -n "${COOKIE:-}" ]]; then
  curl -sI -H "Cookie: $COOKIE" "http://127.0.0.1:${PORT}/course/videos/module-0-socle.mp4" | head -20
  echo "---"
  curl -sI -H "Cookie: $COOKIE" -H "Range: bytes=0-1" "http://127.0.0.1:${PORT}/course/videos/module-0-socle.mp4" | head -20
fi

echo
echo "== Test navigateur =="
echo "Connecté Premium, ouvre DIRECTEMENT:"
echo "  https://app.torinvest-trading.com/course/videos/module-0-socle.mp4"
echo "• Si la vidéo joue / télécharge → OK serveur (problème HTML/CSP page)"
echo "• Si redirect login → cookie session pas envoyé"
echo "• Si 404 → route/static"
echo "• Si fichier illisible / écran noir → codec (souvent HEVC). Re-encoder H.264:"
echo "  ffmpeg -i module-0-socle.mp4 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart module-0-socle-h264.mp4"
