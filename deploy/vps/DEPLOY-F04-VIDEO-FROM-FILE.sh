#!/usr/bin/env bash
# Module F4 — vidéo PROTÉGÉE (MP4 session Premium).
# Injectée DANS le placeholder existant data-video-id="f04-actifs-correlations"
# (« Vidéo — Matrice intermarchés live • XAU vs DXY vs US10Y »).
#
# Fichier source (ton PC) — MKV OK, on convertit en H.264 :
#   E:\TORINVEST\live torinvest\2026-10-27 21-36-56.mkv
#
# 1) Upload depuis Ubuntu / PowerShell :
#    scp "E:\TORINVEST\live torinvest\2026-10-27 21-36-56.mkv" ubuntu@164.132.46.191:~/f04-actifs-marches.mkv
#
# 2) Sur le VPS :
#    export VIDEO_SRC=~/f04-actifs-marches.mkv
#    export REF=cursor/module-f04-video-691a
#    curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-F04-VIDEO-FROM-FILE.sh" -o /tmp/d-f04.sh
#    bash /tmp/d-f04.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/module-f04-video-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
VIDEO_NAME="${VIDEO_NAME:-f04-actifs-marches.mp4}"
CAPTION="${CAPTION:-TORINVEST La Forge - F4 Classes d actifs et correlations}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_SRC="${VIDEO_SRC:-}"

echo "======== F04 VIDEO FROM FILE ($REF) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$APP_DIR/public/css"

if [[ -z "$VIDEO_SRC" ]]; then
  shopt -s nullglob
  candidates=(
    "$PUBLIC_VID"
    "$HOME/f04-actifs-marches.mp4"
    "$HOME/f04-actifs-marches.mkv"
    "$HOME/f04-actifs-marches.webm"
    "$HOME/f04.mp4"
    "$HOME/f04.mkv"
    "$HOME/module-f04.mp4"
    "$HOME/module-f04.mkv"
    "$HOME/F4"*.mp4
    "$HOME/F4"*.mkv
    "$HOME/2026-10-27 21-36-56.mkv"
    "$HOME/2026-10-27"*.mkv
    "$HOME/2026-10-27"*.mp4
    "$HOME/$VIDEO_NAME"
    "$HOME/Downloads/$VIDEO_NAME"
    "/tmp/$VIDEO_NAME"
    "/tmp/f04-actifs-marches.mp4"
    "/tmp/f04-actifs-marches.mkv"
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
  echo "ERREUR : fichier vidéo F4 introuvable (mp4/mkv/webm)."
  echo ""
  echo "  1) Upload depuis ton PC (PowerShell) :"
  echo "     scp \"E:\\TORINVEST\\live torinvest\\2026-10-27 21-36-56.mkv\" ubuntu@164.132.46.191:~/f04-actifs-marches.mkv"
  echo "  2) Relance :"
  echo "     export VIDEO_SRC=~/f04-actifs-marches.mkv"
  echo "     export REF=$REF"
  echo "     curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-F04-VIDEO-FROM-FILE.sh -o /tmp/d-f04.sh && bash /tmp/d-f04.sh"
  exit 1
fi

echo "Source : $VIDEO_SRC ($(ls -lh "$VIDEO_SRC" | awk '{print $5}'))"

WORK="/tmp/forge-f04-vid-$$"
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
    echo "ERREUR: ffmpeg requis pour convertir le MKV en H.264/MP4"
    echo "  sudo apt-get update && sudo apt-get install -y ffmpeg"
    exit 1
  fi
  echo "==> Transcode MKV/autre → H.264 + AAC (fps=30, preset=veryfast)…"
  echo "    (327 Mo MKV → quelques minutes selon CPU VPS)"
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
curl -fsSL "$RAW/deploy/vps/HOTFIX-F04-VIDEO-NOW.sh" -o /tmp/hf04-from-deploy.sh
chmod +x /tmp/hf04-from-deploy.sh
bash /tmp/hf04-from-deploy.sh

echo ""
echo "Auth check (doit rediriger sans cookie) :"
curl -sI "https://app.torinvest-trading.com/course/videos/$VIDEO_NAME" | head -5 || true
echo "→ https://app.torinvest-trading.com/course/f04-actifs-marches.html"
echo "======== DONE ========"
