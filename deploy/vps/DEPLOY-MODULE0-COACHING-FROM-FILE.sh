#!/usr/bin/env bash
# Module 0 — vidéo replay coaching (protégée, layout préservé comme F1).
#
# 1) PC (PowerShell) :
#    scp "C:\Users\gheza\Downloads\GMT20260920-203338_Recording_1686x768_0.mp4" ubuntu@164.132.46.191:~/module0-coaching.mp4
#
# 2) VPS :
#    export VIDEO_SRC=~/module0-coaching.mp4
#    export REF=cursor/module-f01-video-691a
#    curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-MODULE0-COACHING-FROM-FILE.sh" -o /tmp/d-m0c.sh
#    bash /tmp/d-m0c.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/module-f01-video-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
VIDEO_NAME="${VIDEO_NAME:-module-0-coaching.mp4}"
CAPTION="${CAPTION:-TORINVEST · La Forge — Replay coaching Module 0}"
SECTION_TITLE="${SECTION_TITLE:-Replay coaching — Live Module 0}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_URL="/course/videos/$VIDEO_NAME"
VIDEO_SRC="${VIDEO_SRC:-}"
FORCE_COMPRESS="${FORCE_COMPRESS:-1}"

echo "======== MODULE0 COACHING VIDEO ($REF) ========"
mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$APP_DIR/public/css"

if [[ -z "$VIDEO_SRC" ]]; then
  shopt -s nullglob
  for c in \
    "$PUBLIC_VID" \
    "$HOME/module0-coaching.mp4" \
    "$HOME/module-0-coaching.mp4" \
    "$HOME/GMT20260920-203338_Recording_1686x768_0.mp4" \
    "$HOME"/GMT*_Recording*.mp4 \
    "$HOME/Downloads/GMT20260920-203338_Recording_1686x768_0.mp4" \
    "$HOME"/Downloads/GMT*_Recording*.mp4 \
    "/tmp/module0-coaching.mp4" \
    "/tmp/GMT20260920-203338_Recording_1686x768_0.mp4"
  do
    if [[ -f "$c" ]] && [[ $(stat -c%s "$c" 2>/dev/null || echo 0) -gt 500000 ]]; then
      VIDEO_SRC="$c"
      break
    fi
  done
  shopt -u nullglob
fi

if [[ -z "$VIDEO_SRC" || ! -f "$VIDEO_SRC" ]]; then
  echo "ERREUR : recording coaching Module 0 introuvable."
  echo "  scp \"C:\\Users\\gheza\\Downloads\\GMT20260920-203338_Recording_1686x768_0.mp4\" ubuntu@164.132.46.191:~/module0-coaching.mp4"
  echo "  export VIDEO_SRC=~/module0-coaching.mp4 REF=$REF"
  echo "  bash /tmp/d-m0c.sh"
  exit 1
fi

echo "Source : $VIDEO_SRC ($(ls -lh "$VIDEO_SRC" | awk '{print $5}'))"
WORK="/tmp/forge-m0-coach-$$"
mkdir -p "$WORK"

vcodec=""; acodec=""
if command -v ffprobe >/dev/null 2>&1; then
  vcodec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  acodec=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  echo "Codecs : vidéo=$vcodec audio=$acodec"
fi

# 1686x768 Zoom — scale max 1280 + fps=30 pour ne pas élargir la page
if [[ "$FORCE_COMPRESS" == "1" ]] || [[ "$vcodec" != "h264" ]]; then
  command -v ffmpeg >/dev/null 2>&1 || { echo "ERREUR: ffmpeg requis"; exit 1; }
  echo "==> Encode web (max 1280px, fps=30, veryfast)…"
  ffmpeg -y -i "$VIDEO_SRC" \
    -vf "scale='min(1280,iw)':-2,fps=30,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 26 \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart \
    -fps_mode cfr \
    "$WORK/out.mp4"
  cp -a "$WORK/out.mp4" "$PUBLIC_VID"
else
  echo "==> Copie +faststart…"
  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -y -i "$VIDEO_SRC" -c copy -movflags +faststart "$WORK/out.mp4" \
      && cp -a "$WORK/out.mp4" "$PUBLIC_VID" \
      || cp -a "$VIDEO_SRC" "$PUBLIC_VID"
  else
    cp -a "$VIDEO_SRC" "$PUBLIC_VID"
  fi
fi
chmod 644 "$PUBLIC_VID"
cp -a "$PUBLIC_VID" "$PRIVATE_VID"
chmod 644 "$PRIVATE_VID"
echo "OK MP4 : $(ls -lh "$PUBLIC_VID" | awk '{print $5}')"

curl -fsSL "$RAW/la-forge/css/forge-lesson-video.css" -o "$APP_DIR/public/css/forge-lesson-video.css" || true

HTML=""
for candidate in \
  "$APP_DIR/private/course/intro-metier.html" \
  "$APP_DIR/public/course/intro-metier.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -z "$HTML" ]] && HTML=$(find "$APP_DIR" -type f -iname 'intro-metier.html' 2>/dev/null | head -1 || true)
[[ -n "$HTML" && -f "$HTML" ]] || { echo "ERREUR: intro-metier.html introuvable"; exit 1; }

echo "HTML : $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-m0coach-$STAMP"

python3 - "$HTML" "$VIDEO_URL" "$CAPTION" "$SECTION_TITLE" <<'PY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url = sys.argv[2]
caption = sys.argv[3]
section_title = sys.argv[4]
text = html_path.read_text(encoding="utf-8")

ms, me = "<!-- FORGE_MODULE0_COACHING_START -->", "<!-- FORGE_MODULE0_COACHING_END -->"

block = f"""{ms}
<section class="forge-lesson-video-slot" data-video-id="module0-coaching" id="module0-coaching">
  <h2 class="forge-lesson-video-heading">{section_title}</h2>
  <p class="forge-lesson-video-lead">Replay du live coaching — session Premium.</p>
  <figure class="forge-lesson-video forge-lesson-video--protected" id="module0-video-coaching">
    <video controls playsinline preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false">
      <source src="{video_url}" type="video/mp4" />
      Votre navigateur ne lit pas la vidéo HTML5.
    </video>
    <figcaption>{caption}</figcaption>
  </figure>
</section>
{me}"""

text = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", text, flags=re.S)
text = re.sub(
    r'<(?:section|div)[^>]*(?:id=["\']module0-coaching["\']|data-video-id=["\']module0-coaching["\'])[^>]*>.*?</(?:section|div)\s*>',
    "",
    text,
    flags=re.I | re.S,
)

action = None

m = re.search(
    r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\']module0-coaching["\'][^>]*)>(.*?)</\1\s*>',
    text,
    flags=re.I | re.S,
)
if m:
    tag, attrs = m.group(1), m.group(2)
    inner = f"""{ms}
  <h2 class="forge-lesson-video-heading">{section_title}</h2>
  <p class="forge-lesson-video-lead">Replay du live coaching — session Premium.</p>
  <figure class="forge-lesson-video forge-lesson-video--protected" id="module0-video-coaching">
    <video controls playsinline preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false">
      <source src="{video_url}" type="video/mp4" />
      Votre navigateur ne lit pas la vidéo HTML5.
    </video>
    <figcaption>{caption}</figcaption>
  </figure>
{me}"""
    text = text[: m.start()] + f"<{tag}{attrs}>\n{inner}\n</{tag}>" + text[m.end() :]
    action = "remplacé data-video-id=module0-coaching"
else:
    # Après vidéo 2 (métier), sinon après vidéo 1
    m2 = re.search(r"<!--\s*FORGE_MODULE0_VIDEO2_END\s*-->", text, flags=re.I)
    if m2:
        text = text[: m2.end()] + "\n\n" + block + "\n" + text[m2.end() :]
        action = "inséré après FORGE_MODULE0_VIDEO2_END"
    else:
        m1 = re.search(r"<!--\s*FORGE_MODULE0_VIDEO_END\s*-->", text, flags=re.I)
        if m1:
            text = text[: m1.end()] + "\n\n" + block + "\n" + text[m1.end() :]
            action = "inséré après FORGE_MODULE0_VIDEO_END"
        else:
            mfig = re.search(
                r'(<figure[^>]*id=["\']module0-video-2["\'][^>]*>.*?</figure>)',
                text,
                flags=re.I | re.S,
            )
            if not mfig:
                mfig = re.search(
                    r'(<figure[^>]*id=["\']module0-video["\'][^>]*>.*?</figure>)',
                    text,
                    flags=re.I | re.S,
                )
            if mfig:
                text = text[: mfig.end()] + "\n\n" + block + "\n" + text[mfig.end() :]
                action = "inséré après figure module0"
            else:
                print("ERREUR: point d'insertion Module 0 introuvable", file=sys.stderr)
                sys.exit(2)

if "forge-lesson-video.css" not in text and "</head>" in text:
    text = text.replace(
        "</head>",
        '  <link rel="stylesheet" href="/css/forge-lesson-video.css?v=m0c" />\n</head>',
        1,
    )
else:
    text = re.sub(
        r'forge-lesson-video\.css(\?v=[^"]*)?',
        "forge-lesson-video.css?v=m0c",
        text,
        count=1,
    )

text = re.sub(r"\n{4,}", "\n\n\n", text)
html_path.write_text(text, encoding="utf-8")
print("Action :", action)
if "module-0-coaching.mp4" not in text and video_url.split("/")[-1] not in text:
    print("ERREUR: mp4 coaching absent du HTML", file=sys.stderr)
    sys.exit(3)
PY

if [[ "$HTML" == "$APP_DIR/private/course/intro-metier.html" ]]; then
  mkdir -p "$APP_DIR/public/course"
  cp -a "$HTML" "$APP_DIR/public/course/intro-metier.html"
  echo "Sync public HTML"
fi

rm -rf "$WORK"

echo ""
grep -n "module-0-coaching\|FORGE_MODULE0_COACHING\|module0-video-coaching" "$HTML" | head -20
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"
echo ""
echo "OK — replay coaching Module 0 branché."
echo "→ Hard refresh : https://app.torinvest-trading.com/course/intro-metier.html"
echo "======== DONE ========"
