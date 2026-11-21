#!/usr/bin/env bash
# Module F5 — vidéo PROTÉGÉE (MP4 session Premium).
# Injectée dans le placeholder du module Price Action pur.
#
# Fichier source (ton PC) :
#   E:\TORINVEST\live torinvest\F5 - Price action pur .mp4
#   (attention : espace avant .mp4 dans le nom Windows)
#
# 1) Upload PowerShell :
#    scp "E:\TORINVEST\live torinvest\F5 - Price action pur .mp4" ubuntu@164.132.46.191:~/f05-price-action.mp4
#
# 2) Sur le VPS :
#    export VIDEO_SRC=~/f05-price-action.mp4
#    export REF=cursor/module-f05-video-691a
#    curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-F05-VIDEO-FROM-FILE.sh" -o /tmp/d-f05.sh
#    bash /tmp/d-f05.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/module-f05-video-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
VIDEO_NAME="${VIDEO_NAME:-f05-price-action.mp4}"
CAPTION="${CAPTION:-TORINVEST La Forge - F5 Price Action pur}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_SRC="${VIDEO_SRC:-}"

echo "======== F05 VIDEO FROM FILE ($REF) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$APP_DIR/public/css"

if [[ -z "$VIDEO_SRC" ]]; then
  shopt -s nullglob
  candidates=(
    "$PUBLIC_VID"
    "$HOME/f05-price-action.mp4"
    "$HOME/f05-price-action.mkv"
    "$HOME/f05.mp4"
    "$HOME/F5"*.mp4
    "$HOME/F5"*.mkv
    "$HOME/F5 - Price action pur .mp4"
    "$HOME/F5 - Price action pur.mp4"
    "$HOME/$VIDEO_NAME"
    "$HOME/Downloads/$VIDEO_NAME"
    "/tmp/$VIDEO_NAME"
    "/tmp/f05-price-action.mp4"
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
  echo "ERREUR : fichier vidéo F5 introuvable (mp4/mkv)."
  echo ""
  echo "  1) Upload depuis ton PC (PowerShell) :"
  echo "     scp \"E:\\TORINVEST\\live torinvest\\F5 - Price action pur .mp4\" ubuntu@164.132.46.191:~/f05-price-action.mp4"
  echo "  2) Relance :"
  echo "     export VIDEO_SRC=~/f05-price-action.mp4"
  echo "     export REF=$REF"
  echo "     curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-F05-VIDEO-FROM-FILE.sh -o /tmp/d-f05.sh && bash /tmp/d-f05.sh"
  exit 1
fi

echo "Source : $VIDEO_SRC ($(ls -lh "$VIDEO_SRC" | awk '{print $5}'))"

WORK="/tmp/forge-f05-vid-$$"
mkdir -p "$WORK"
need_transcode=1
if command -v ffprobe >/dev/null 2>&1; then
  vcodec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  acodec=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  ext="${VIDEO_SRC##*.}"
  echo "Codecs détectés : vidéo=$vcodec audio=$acodec ext=$ext"
  if [[ "${ext,,}" == "mp4" ]] && [[ "$vcodec" == "h264" ]] && { [[ "$acodec" == "aac" ]] || [[ "$acodec" == "mp3" ]] || [[ -z "$acodec" ]]; }; then
    need_transcode=0
  fi
fi

if [[ "$need_transcode" -eq 1 ]]; then
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "ERREUR: ffmpeg requis pour convertir en H.264/MP4"
    echo "  sudo apt-get update && sudo apt-get install -y ffmpeg"
    exit 1
  fi
  echo "==> Transcode → H.264 + AAC (fps=30, preset=veryfast)…"
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
rm -rf "$WORK"

curl -fsSL "$RAW/la-forge/css/forge-lesson-video.css" -o "$APP_DIR/public/css/forge-lesson-video.css" || true

export APP_DIR VIDEO_NAME CAPTION
curl -fsSL "$RAW/deploy/vps/HOTFIX-F05-VIDEO-NOW.sh" -o /tmp/hf05-from-deploy.sh
chmod +x /tmp/hf05-from-deploy.sh
bash /tmp/hf05-from-deploy.sh

echo ""
echo "Auth check (doit rediriger sans cookie) :"
curl -sI "https://app.torinvest-trading.com/course/videos/$VIDEO_NAME" | head -5 || true
echo "→ https://app.torinvest-trading.com/course/f05-price-action.html"
echo "======== DONE ========"
