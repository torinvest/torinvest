#!/usr/bin/env bash
# Module F2 — vidéo PROTÉGÉE (MP4 session Premium), même pattern que F1 / Module 0.
#
# Fichier source (ton PC) :
#   E:\TORINVEST\live torinvest\F2 XAUUSD — anatomie de l'or.mp4
#
# 1) Upload depuis PowerShell / CMD (renomme en f02-xauusd.mp4 pour éviter accents) :
#    scp "E:\TORINVEST\live torinvest\F2 XAUUSD — anatomie de l'or.mp4" ubuntu@164.132.46.191:~/f02-xauusd.mp4
#
# 2) Sur le VPS :
#    export VIDEO_SRC=~/f02-xauusd.mp4
#    export REF=cursor/module-f2-xauusd-video-691a
#    curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-F02-VIDEO-FROM-FILE.sh" -o /tmp/d-f02.sh
#    bash /tmp/d-f02.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/module-f2-xauusd-video-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
VIDEO_NAME="${VIDEO_NAME:-f02-xauusd.mp4}"
CAPTION="${CAPTION:-TORINVEST La Forge - F2 XAUUSD - anatomie de lor}"
TITLE="${TITLE:-Video - XAUUSD anatomie de lor}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_URL="/course/videos/$VIDEO_NAME"
VIDEO_SRC="${VIDEO_SRC:-}"

echo "======== F02 VIDEO FROM FILE ($REF) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$APP_DIR/public/css"

# ——— Trouver le fichier source ———
if [[ -z "$VIDEO_SRC" ]]; then
  shopt -s nullglob
  candidates=(
    "$PUBLIC_VID"
    "$HOME/f02-xauusd.mp4"
    "$HOME/f02-xauusd.mkv"
    "$HOME/f02-xauusd.webm"
    "$HOME/f02.mp4"
    "$HOME/module-f02.mp4"
    "$HOME/F2"*.mp4
    "$HOME/F2"*.mkv
    "$HOME/$VIDEO_NAME"
    "$HOME/Downloads/$VIDEO_NAME"
    "/tmp/$VIDEO_NAME"
    "/tmp/f02-xauusd.mp4"
    "/tmp/f02-xauusd.mkv"
  )
  for c in "${candidates[@]}"; do
    if [[ -f "$c" ]] && [[ $(stat -c%s "$c" 2>/dev/null || echo 0) -gt 500000 ]]; then
      VIDEO_SRC="$c"
      break
    fi
  done
  shopt -u nullglob
fi

if [[ -z "$VIDEO_SRC" || ! -f "$VIDEO_SRC" ]]; then
  echo "ERREUR : fichier vidéo F2 introuvable (mp4/mkv/webm)."
  echo ""
  echo "  1) Upload depuis ton PC (PowerShell) :"
  echo "     scp \"E:\\TORINVEST\\live torinvest\\F2 XAUUSD — anatomie de l'or.mp4\" ubuntu@164.132.46.191:~/f02-xauusd.mp4"
  echo "  2) Relance :"
  echo "     export VIDEO_SRC=~/f02-xauusd.mp4"
  echo "     export REF=$REF"
  echo "     curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-F02-VIDEO-FROM-FILE.sh -o /tmp/d-f02.sh && bash /tmp/d-f02.sh"
  exit 1
fi

echo "Source : $VIDEO_SRC ($(ls -lh "$VIDEO_SRC" | awk '{print $5}'))"

# ——— Normalise H.264 si besoin ———
WORK="/tmp/forge-f02-vid-$$"
mkdir -p "$WORK"
need_transcode=1
if command -v ffprobe >/dev/null 2>&1; then
  vcodec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  acodec=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  echo "Codecs détectés : vidéo=$vcodec audio=$acodec"
  if [[ "$vcodec" == "h264" ]] && { [[ "$acodec" == "aac" ]] || [[ "$acodec" == "mp3" ]] || [[ -z "$acodec" ]]; }; then
    need_transcode=0
  fi
fi

if [[ "$need_transcode" -eq 1 ]]; then
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "ERREUR: ffmpeg requis pour convertir en H.264"
    exit 1
  fi
  echo "==> Transcode H.264 + AAC (fps=30, preset=veryfast)…"
  ffmpeg -y -i "$VIDEO_SRC" \
    -vf "fps=30,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 26 \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart \
    -fps_mode cfr \
    "$WORK/out.mp4"
  cp -a "$WORK/out.mp4" "$PUBLIC_VID"
else
  echo "==> Copie directe (+faststart si possible)..."
  if command -v ffmpeg >/dev/null 2>&1; then
    if ffmpeg -y -i "$VIDEO_SRC" -c copy -movflags +faststart "$WORK/out.mp4"; then
      cp -a "$WORK/out.mp4" "$PUBLIC_VID"
    else
      cp -a "$VIDEO_SRC" "$PUBLIC_VID"
    fi
  else
    cp -a "$VIDEO_SRC" "$PUBLIC_VID"
  fi
fi
chmod 644 "$PUBLIC_VID"
cp -a "$PUBLIC_VID" "$PRIVATE_VID"
chmod 644 "$PRIVATE_VID"
echo "OK MP4 : $(ls -lh "$PUBLIC_VID" | awk '{print $5}')"

# CSS protection
curl -fsSL "$RAW/la-forge/css/forge-lesson-video.css" -o "$APP_DIR/public/css/forge-lesson-video.css" || true

# HTML cible F2
HTML=""
for candidate in \
  "$APP_DIR/private/course/f02-xauusd.html" \
  "$APP_DIR/public/course/f02-xauusd.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -z "$HTML" ]] && HTML=$(find "$APP_DIR" -type f -iname 'f02-xauusd.html' 2>/dev/null | head -1 || true)
if [[ -z "$HTML" || ! -f "$HTML" ]]; then
  echo "ERREUR: f02-xauusd.html introuvable"
  exit 1
fi

echo "HTML : $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-f02vid-$STAMP"

# Injection — meme emplacement que Module 0 / F1 (slot data-video-id)
curl -fsSL "$RAW/deploy/vps/_inject_f02_video.py" -o "$WORK/inject-f02.py"
python3 "$WORK/inject-f02.py" "$HTML" "$VIDEO_URL" "$CAPTION"


# sync public html
if [[ "$HTML" == "$APP_DIR/private/course/f02-xauusd.html" ]]; then
  mkdir -p "$APP_DIR/public/course"
  cp -a "$HTML" "$APP_DIR/public/course/f02-xauusd.html"
  echo "Sync public HTML"
fi

rm -rf "$WORK"

echo ""
echo "Vérif :"
grep -n "f02-xauusd.mp4\|FORGE_F02_VIDEO\|controlslist\|f02-video\|youtube.com/embed" "$HTML" | head -25
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"

if ! grep -q "f02-xauusd.mp4" "$HTML"; then
  echo ""
  echo "ERREUR : f02-xauusd.mp4 absent du HTML"
  exit 3
fi
if [[ ! -f "$PUBLIC_VID" ]] || [[ $(stat -c%s "$PUBLIC_VID") -lt 500000 ]]; then
  echo "ERREUR : MP4 final trop petit ou manquant : $PUBLIC_VID"
  exit 3
fi

echo ""
echo "OK — player F2 protégé branché."
echo "→ Hard refresh : https://app.torinvest-trading.com/course/f02-xauusd.html"
echo "======== DONE ========"
