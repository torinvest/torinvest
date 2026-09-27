#!/usr/bin/env bash
# Module F1 — vidéo PROTÉGÉE (MP4 session Premium), même pattern que Module 0.
#
# 1) Depuis ton PC (PowerShell / CMD), upload la vidéo :
#    scp "C:\Users\gheza\Downloads\video-idea_1e4fd.webm" ubuntu@164.132.46.191:~/f01-marches.webm
#    # .webm / .mkv / .mp4 — le script transcodera en H.264 MP4 si besoin
#
# 2) Sur le VPS :
#    export VIDEO_SRC=~/f01-marches.webm
#    export REF=cursor/module-f01-video-691a
#    curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-F01-VIDEO-FROM-FILE.sh" -o /tmp/d-f01.sh
#    bash /tmp/d-f01.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/module-f01-video-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
VIDEO_NAME="${VIDEO_NAME:-f01-marches.mp4}"
CAPTION="${CAPTION:-TORINVEST · La Forge — F1 Participants & microstructure}"
TITLE="${TITLE:-Vidéo — Participants & microstructure}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_URL="/course/videos/$VIDEO_NAME"
VIDEO_SRC="${VIDEO_SRC:-}"

echo "======== F01 VIDEO FROM FILE ($REF) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$APP_DIR/public/css"

# ——— Trouver le fichier source ———
if [[ -z "$VIDEO_SRC" ]]; then
  # webm / mkv / mp4 (Downloads Cursor → video-idea_*.webm)
  shopt -s nullglob
  candidates=(
    "$PUBLIC_VID"
    "$HOME/f01-marches.webm"
    "$HOME/f01-marches.mkv"
    "$HOME/f01-marches.mp4"
    "$HOME/module-f01.webm"
    "$HOME/module-f01.mkv"
    "$HOME/module-f01.mp4"
    "$HOME/f01.webm"
    "$HOME/f01.mkv"
    "$HOME/f01.mp4"
    "$HOME/video-idea_1e4fd.webm"
    "$HOME"/video-idea*.webm
    "$HOME/$VIDEO_NAME"
    "$HOME/Downloads/$VIDEO_NAME"
    "$HOME/Downloads/video-idea_1e4fd.webm"
    "$HOME"/Downloads/video-idea*.webm
    "/tmp/$VIDEO_NAME"
    "/tmp/f01-marches.webm"
    "/tmp/f01-marches.mkv"
    "/tmp/f01-marches.mp4"
    "/tmp/video-idea_1e4fd.webm"
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
  echo "ERREUR : fichier vidéo F1 introuvable (webm/mp4/mkv)."
  echo ""
  echo "  1) Upload depuis ton PC (PowerShell) :"
  echo "     scp \"C:\\Users\\gheza\\Downloads\\video-idea_1e4fd.webm\" ubuntu@164.132.46.191:~/f01-marches.webm"
  echo "  2) Relance :"
  echo "     export VIDEO_SRC=~/f01-marches.webm"
  echo "     export REF=$REF"
  echo "     curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-F01-VIDEO-FROM-FILE.sh -o /tmp/d-f01.sh && bash /tmp/d-f01.sh"
  exit 1
fi

echo "Source : $VIDEO_SRC ($(ls -lh "$VIDEO_SRC" | awk '{print $5}'))"

# ——— Normalise H.264 si besoin ———
WORK="/tmp/forge-f01-vid-$$"
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
  # WEBM Cursor : timebase bizarre → millions de frames dupliquées (0.2x).
  # Forcer 30 fps + preset veryfast = encode rapide (~quelques minutes).
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

# HTML cible F1
HTML=""
for candidate in \
  "$APP_DIR/private/course/f01-marches.html" \
  "$APP_DIR/public/course/f01-marches.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -z "$HTML" ]] && HTML=$(find "$APP_DIR" -type f -iname 'f01-marches.html' 2>/dev/null | head -1 || true)
if [[ -z "$HTML" || ! -f "$HTML" ]]; then
  echo "ERREUR: f01-marches.html introuvable"
  exit 1
fi

echo "HTML : $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-f01vid-$STAMP"

python3 - "$HTML" "$VIDEO_URL" "$CAPTION" "$TITLE" <<'PY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url = sys.argv[2]
caption = sys.argv[3]
title = sys.argv[4]
text = html_path.read_text(encoding="utf-8")

marker_start = "<!-- FORGE_F01_VIDEO_START -->"
marker_end = "<!-- FORGE_F01_VIDEO_END -->"

block = f"""<!-- FORGE_F01_VIDEO_START -->
<figure class="forge-lesson-video forge-lesson-video--protected" id="f01-video">
  <h2 style="color:var(--gold,#ffd700);font-size:1.05rem;margin:1.5rem 0 0.65rem;text-align:center;">
    {title}
  </h2>
  <video
    controls
    playsinline
    preload="metadata"
    controlslist="nodownload noplaybackrate"
    disablepictureinpicture
    oncontextmenu="return false"
    style="width:100%;max-width:960px;border-radius:12px;background:#000;display:block;margin:0 auto;"
  >
    <source src="{video_url}" type="video/mp4" />
    Votre navigateur ne lit pas la vidéo HTML5.
  </video>
  <figcaption style="text-align:center;color:#9aa3b2;font-size:0.9rem;margin-top:0.5rem;margin-bottom:1.25rem;">
    {caption}
  </figcaption>
</figure>
<!-- FORGE_F01_VIDEO_END -->"""

if marker_start in text and marker_end in text:
    text = re.sub(
        re.escape(marker_start) + r".*?" + re.escape(marker_end),
        block,
        text,
        count=1,
        flags=re.S,
    )
    action = "remplacé marqueurs F01"
else:
    # purge éventuel YouTube / placeholder
    text = re.sub(
        r'<section[^>]*id="f01-video"[^>]*>.*?</section>',
        "",
        text,
        flags=re.I | re.S,
    )
    text = re.sub(
        r'<figure[^>]*id="f01-video"[^>]*>.*?</figure>',
        "",
        text,
        flags=re.I | re.S,
    )
    # après le premier <h1>…</h1>
    m = re.search(r"(<h1[^>]*>.*?</h1>)", text, flags=re.I | re.S)
    if m:
        text = text[: m.end()] + "\n\n" + block + "\n" + text[m.end() :]
        action = "inséré après <h1>"
    else:
        m2 = re.search(r'(<main[^>]*>|<div[^>]*class="[^"]*lesson[^"]*"[^>]*>)', text, flags=re.I)
        if not m2:
            print("ERREUR: point d'insertion introuvable (pas de h1)", file=sys.stderr)
            sys.exit(2)
        text = text[: m2.end()] + "\n\n" + block + "\n" + text[m2.end() :]
        action = "inséré après main/lesson"

if "forge-lesson-video.css" not in text and "</head>" in text:
    text = text.replace(
        "</head>",
        '  <link rel="stylesheet" href="/css/forge-lesson-video.css" />\n</head>',
        1,
    )

html_path.write_text(text, encoding="utf-8")
print("Action :", action)
PY

# sync public html
if [[ "$HTML" == "$APP_DIR/private/course/f01-marches.html" ]]; then
  mkdir -p "$APP_DIR/public/course"
  cp -a "$HTML" "$APP_DIR/public/course/f01-marches.html"
  echo "Sync public HTML"
fi

rm -rf "$WORK"

echo ""
echo "Vérif :"
grep -n "f01-marches.mp4\|FORGE_F01_VIDEO\|controlslist\|f01-video\|youtube.com/embed" "$HTML" | head -25
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"

if ! grep -q "f01-marches.mp4" "$HTML"; then
  echo ""
  echo "ERREUR : f01-marches.mp4 absent du HTML"
  exit 3
fi
if [[ ! -f "$PUBLIC_VID" ]] || [[ $(stat -c%s "$PUBLIC_VID") -lt 500000 ]]; then
  echo "ERREUR : MP4 final trop petit ou manquant : $PUBLIC_VID"
  exit 3
fi

echo ""
echo "OK — player F1 protégé branché."
echo "→ Hard refresh : https://app.torinvest-trading.com/course/f01-marches.html"
echo "======== DONE ========"
