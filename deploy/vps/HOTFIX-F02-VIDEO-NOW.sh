#!/usr/bin/env bash
# HOTFIX F2 — copie le placement F1 (slot grille), retire le player sous h1
# (slot data-video-id / section "Video — …"), PAS sous le h1 du module.
#
# PC (si pas encore uploade) :
#   scp "...\F2 XAUUSD — anatomie de l'or.mp4" ubuntu@164.132.46.191:~/f02-xauusd.mp4
#
# VPS :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/module-f2-xauusd-video-691a/deploy/vps/HOTFIX-F02-VIDEO-NOW.sh" -o /tmp/hf02.sh
#   bash /tmp/hf02.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/module-f2-video-slot-f01-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
VIDEO_NAME="f02-xauusd.mp4"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_URL="/course/videos/$VIDEO_NAME"
CAPTION="${CAPTION:-TORINVEST La Forge - F2 XAUUSD - anatomie de lor}"

echo "############################################################"
echo "#  HOTFIX F2 VIDEO SLOT (comme Module 0 / F1)             #"
echo "#  ref: $REF                                              #"
echo "############################################################"

mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$APP_DIR/public/css" "$APP_DIR/public/course"

VIDEO_SRC="${VIDEO_SRC:-}"
if [[ -z "$VIDEO_SRC" ]]; then
  shopt -s nullglob
  for c in "$HOME/f02-xauusd.mp4" "$PUBLIC_VID" "$PRIVATE_VID" "/tmp/f02-xauusd.mp4" "$HOME"/F2*.mp4; do
    [[ -f "$c" ]] || continue
    sz=$(stat -c%s "$c" 2>/dev/null || echo 0)
    if [[ "$sz" -gt 500000 ]]; then VIDEO_SRC="$c"; break; fi
  done
  shopt -u nullglob
fi

if [[ -z "${VIDEO_SRC:-}" || ! -f "$VIDEO_SRC" ]]; then
  echo "ECHEC: ~/f02-xauusd.mp4 introuvable. Upload puis relance."
  exit 1
fi
echo "Source : $VIDEO_SRC ($(ls -lh "$VIDEO_SRC" | awk '{print $5}'))"

WORK="/tmp/forge-f02-hotfix-$$"
mkdir -p "$WORK"

# Ensure MP4 in place (copy if needed; already h264 from prior run)
if [[ ! -f "$PUBLIC_VID" ]] || [[ $(stat -c%s "$PUBLIC_VID" 2>/dev/null || echo 0) -lt 500000 ]]; then
  need_transcode=1
  if command -v ffprobe >/dev/null 2>&1; then
    vcodec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
    acodec=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
    echo "Codecs : v=$vcodec a=$acodec"
    if [[ "$vcodec" == "h264" ]] && { [[ "$acodec" == "aac" ]] || [[ "$acodec" == "mp3" ]] || [[ -z "$acodec" ]]; }; then
      need_transcode=0
    fi
  fi
  if [[ "$need_transcode" -eq 1 ]]; then
    command -v ffmpeg >/dev/null 2>&1 || { echo "ERREUR: ffmpeg requis"; exit 1; }
    ffmpeg -y -i "$VIDEO_SRC" -vf "fps=30,format=yuv420p" \
      -c:v libx264 -preset veryfast -crf 26 -c:a aac -b:a 128k -ac 2 \
      -movflags +faststart -fps_mode cfr "$WORK/out.mp4"
    cp -a "$WORK/out.mp4" "$PUBLIC_VID"
  else
    if command -v ffmpeg >/dev/null 2>&1 && ffmpeg -y -i "$VIDEO_SRC" -c copy -movflags +faststart "$WORK/out.mp4" 2>/dev/null; then
      cp -a "$WORK/out.mp4" "$PUBLIC_VID"
    else
      cp -a "$VIDEO_SRC" "$PUBLIC_VID"
    fi
  fi
fi
chmod 644 "$PUBLIC_VID"
cp -a "$PUBLIC_VID" "$PRIVATE_VID"
chmod 644 "$PRIVATE_VID"
echo "OK MP4 : $(ls -lh "$PUBLIC_VID" | awk '{print $5}')"

curl -fsSL "$RAW/la-forge/css/forge-lesson-video.css" -o "$APP_DIR/public/css/forge-lesson-video.css" || true
curl -fsSL "$RAW/deploy/vps/_place_f02_like_f01.py" -o "$WORK/place-f02.py"
chmod +x "$WORK/inject-f02.py"

HTML=""
for candidate in \
  "$APP_DIR/private/course/f02-xauusd.html" \
  "$APP_DIR/public/course/f02-xauusd.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
if [[ -z "$HTML" ]]; then
  HTML=$(find "$APP_DIR" -type f -iname 'f02-xauusd.html' 2>/dev/null | head -1 || true)
fi
[[ -n "$HTML" && -f "$HTML" ]] || { echo "ERREUR: f02-xauusd.html introuvable"; exit 1; }

echo "HTML : $HTML"
echo "--- diagnostic slot (comme F0/F1) ---"
grep -nE 'data-video|Integration|Intégration|Vidéo|Video —|Video -|FORGE_F02|f02-video|<h1|<h2|<h3' "$HTML" | head -50 || true
echo "-----------------------"

STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-f02slot-$STAMP"

F01=""
for c in \
  "$APP_DIR/private/course/f01-marches.html" \
  "$APP_DIR/public/course/f01-marches.html"
do
  [[ -f "$c" ]] && F01="$c" && break
done
echo "F01 reference : ${F01:-ABSENT}"
python3 "$WORK/place-f02.py" "$HTML" "${F01:-/dev/null}" "$VIDEO_URL" "$CAPTION"

if [[ "$HTML" == "$APP_DIR/private/course/f02-xauusd.html" ]]; then
  cp -a "$HTML" "$APP_DIR/public/course/f02-xauusd.html"
  echo "Sync -> public/course/f02-xauusd.html"
fi

rm -rf "$WORK"

echo ""
echo "=== VERIF ==="
grep -nE 'f02-xauusd.mp4|FORGE_F02_VIDEO|f02-video|data-video-id|controlslist' "$HTML" | head -30
# Must NOT sit immediately after page h1 (wrong place)
if python3 - "$HTML" <<'CHK'
import re, sys
from pathlib import Path
t = Path(sys.argv[1]).read_text(encoding="utf-8")
# fail if f02-video appears within 800 chars after first </h1>
m = re.search(r"</h1\s*>", t, flags=re.I)
if m:
    window = t[m.end() : m.end() + 800]
    if "f02-video" in window or "f02-xauusd.mp4" in window:
        print("WARN: video encore trop proche du h1 — verifie le slot data-video-id")
        sys.exit(0)
print("OK placement: pas colle au h1")
CHK
then true; fi

grep -q "f02-xauusd.mp4" "$HTML" || { echo "ECHEC: mp4 absent du HTML"; exit 3; }
[[ $(stat -c%s "$PUBLIC_VID") -gt 500000 ]] || { echo "ECHEC: MP4 trop petit"; exit 3; }

echo ""
echo "OK — video F2 dans le slot (comme Module 0 / F1)."
echo "-> Ctrl+Shift+R : https://app.torinvest-trading.com/course/f02-xauusd.html"
echo "======== DONE ========"
