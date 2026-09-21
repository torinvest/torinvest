#!/usr/bin/env bash
# Hotfix Module 0 video 2 — remplace YouTube par MP4 protege.
# Prerequisite: ~/module-0-metier.mkv deja sur le VPS (scp).
#
# IMPORTANT — ne pas faire curl|bash (casse les heredocs). Faire :
#   curl -fsSL URL -o /tmp/m0-vid2.sh && bash /tmp/m0-vid2.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
VIDEO_NAME="module-0-metier.mp4"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_URL="/course/videos/$VIDEO_NAME"
WORK="/tmp/forge-vid2-hotfix-$$"

echo "======== HOTFIX MODULE0 VIDEO2 ========"
echo "APP=$APP_DIR"

VIDEO_SRC="${VIDEO_SRC:-}"
if [[ -z "$VIDEO_SRC" ]]; then
  for c in "$HOME/module-0-metier.mkv" "$HOME/module-0-metier.mp4" "$PUBLIC_VID"; do
    if [[ -f "$c" ]] && [[ $(stat -c%s "$c" 2>/dev/null || echo 0) -gt 500000 ]]; then
      VIDEO_SRC="$c"
      break
    fi
  done
fi
if [[ -z "${VIDEO_SRC:-}" || ! -f "$VIDEO_SRC" ]]; then
  echo "ERREUR: ~/module-0-metier.mkv introuvable. Refais le scp."
  ls -lh "$HOME"/module-0-metier.* 2>/dev/null || true
  exit 1
fi
echo "Source: $VIDEO_SRC ($(ls -lh "$VIDEO_SRC" | awk '{print $5}'))"

mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$APP_DIR/public/css" "$WORK"

need_transcode=1
if command -v ffprobe >/dev/null 2>&1; then
  vcodec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null | head -1 | tr -d '\r' || true)
  acodec=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null | head -1 | tr -d '\r' || true)
  echo "Codecs: video=$vcodec audio=$acodec"
  if [[ "$vcodec" == "h264" ]] && { [[ "$acodec" == "aac" ]] || [[ "$acodec" == "mp3" ]] || [[ -z "$acodec" ]]; }; then
    need_transcode=0
  fi
fi

if [[ "$need_transcode" -eq 1 ]]; then
  command -v ffmpeg >/dev/null 2>&1 || { echo "ERREUR: ffmpeg requis"; exit 1; }
  echo "==> Transcode H.264 + AAC (plusieurs minutes possibles)..."
  ffmpeg -y -i "$VIDEO_SRC" \
    -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 \
    -c:a aac -b:a 160k -ac 2 -movflags +faststart \
    "$WORK/out.mp4"
  cp -a "$WORK/out.mp4" "$PUBLIC_VID"
else
  echo "==> Remux faststart..."
  if command -v ffmpeg >/dev/null 2>&1 && ffmpeg -y -i "$VIDEO_SRC" -c copy -movflags +faststart "$WORK/out.mp4"; then
    cp -a "$WORK/out.mp4" "$PUBLIC_VID"
  else
    cp -a "$VIDEO_SRC" "$PUBLIC_VID"
  fi
fi
chmod 644 "$PUBLIC_VID"
cp -a "$PUBLIC_VID" "$PRIVATE_VID"
chmod 644 "$PRIVATE_VID"
echo "OK mp4: $(ls -lh "$PUBLIC_VID" | awk '{print $5}')"

cat > "$APP_DIR/public/css/forge-lesson-video.css" <<'ENDCSS'
.forge-lesson-video--protected video::-webkit-media-controls-download-button{display:none!important}
.forge-lesson-video--protected video{outline:none}
ENDCSS
echo "OK css"

HTML=""
for candidate in \
  "$APP_DIR/private/course/intro-metier.html" \
  "$APP_DIR/public/course/intro-metier.html"
do
  if [[ -f "$candidate" ]]; then HTML="$candidate"; break; fi
done
if [[ -z "$HTML" ]]; then
  HTML=$(find "$APP_DIR" -type f -iname 'intro-metier.html' 2>/dev/null | head -1 || true)
fi
if [[ -z "$HTML" || ! -f "$HTML" ]]; then
  echo "ERREUR: intro-metier.html introuvable sous $APP_DIR"
  find "$HOME" -type f -iname 'intro-metier.html' 2>/dev/null | head -10 || true
  exit 1
fi
echo "HTML: $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-vid2hotfix-$STAMP"

python3 - "$HTML" "$VIDEO_URL" <<'ENDPY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url = sys.argv[2]
text = html_path.read_text(encoding="utf-8")

marker_start = "<!-- FORGE_MODULE0_VIDEO2_START -->"
marker_end = "<!-- FORGE_MODULE0_VIDEO2_END -->"

block = f"""{marker_start}
<figure class="forge-lesson-video forge-lesson-video--protected" id="module0-video-2">
  <h2 style="color:var(--gold,#ffd700);font-size:1.05rem;margin:1.5rem 0 0.65rem;text-align:center;">
    Video 2 - Metier du trader
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
    Votre navigateur ne lit pas la video HTML5.
  </video>
  <figcaption style="text-align:center;color:#9aa3b2;font-size:0.9rem;margin-top:0.5rem;margin-bottom:1.25rem;">
    TORINVEST - La Forge - Metier du trader (video 2)
  </figcaption>
</figure>
{marker_end}"""

if marker_start in text and marker_end in text:
    text = re.sub(
        re.escape(marker_start) + r".*?" + re.escape(marker_end),
        block,
        text,
        count=1,
        flags=re.S,
    )
    action = "replaced VIDEO2 markers"
else:
    text = re.sub(r'<section[^>]*id="module0-video-2"[^>]*>.*?</section>', "", text, flags=re.I | re.S)
    text = re.sub(r'<iframe[^>]+youtube\.com/embed/9-n-CyHiEIo[^>]*>.*?</iframe>', "", text, flags=re.I | re.S)
    text = re.sub(r'<a[^>]+youtube\.com/watch\?v=9-n-CyHiEIo[^>]*>.*?</a>', "", text, flags=re.I | re.S)
    m1 = re.search(r"<!--\s*FORGE_MODULE0_VIDEO_END\s*-->", text, flags=re.I)
    if m1:
        text = text[: m1.end()] + "\n\n" + block + "\n" + text[m1.end() :]
        action = "inserted after video 1"
    else:
        mvid = re.search(r'(<figure[^>]*id="module0-video"[^>]*>.*?</figure>)', text, flags=re.I | re.S)
        if not mvid:
            print("ERREUR: cannot find insertion point", file=sys.stderr)
            sys.exit(2)
        text = text[: mvid.end()] + "\n\n" + block + "\n" + text[mvid.end() :]
        action = "inserted after #module0-video"

if "forge-lesson-video.css" not in text and "</head>" in text:
    text = text.replace("</head>", '  <link rel="stylesheet" href="/css/forge-lesson-video.css" />\n</head>', 1)

html_path.write_text(text, encoding="utf-8")
print("Action:", action)
ENDPY

if [[ "$HTML" == "$APP_DIR/private/course/intro-metier.html" ]]; then
  cp -a "$HTML" "$APP_DIR/public/course/intro-metier.html"
  echo "Synced public HTML"
fi

rm -rf "$WORK"

echo ""
echo "Verif:"
grep -n "module-0-metier.mp4\|FORGE_MODULE0_VIDEO2\|youtube.com/embed/9-n-CyHiEIo\|youtube.com/watch?v=9-n-CyHiEIo" "$HTML" | head -20 || true
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"

if grep -q "youtube.com/embed/9-n-CyHiEIo\|youtube.com/watch?v=9-n-CyHiEIo" "$HTML"; then
  echo "ERREUR: YouTube encore present dans le HTML"
  exit 3
fi
if ! grep -q "module-0-metier.mp4" "$HTML"; then
  echo "ERREUR: module-0-metier.mp4 absent du HTML"
  exit 3
fi
if [[ $(stat -c%s "$PUBLIC_VID") -lt 500000 ]]; then
  echo "ERREUR: MP4 trop petit"
  exit 3
fi

echo ""
echo "OK - YouTube retire, player protege branche."
echo "Hard refresh: https://app.torinvest-trading.com/course/intro-metier.html"
echo "======== DONE ========"
