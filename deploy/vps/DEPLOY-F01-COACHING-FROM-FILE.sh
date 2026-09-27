#!/usr/bin/env bash
# Module F1 — 2ᵉ vidéo : replay coaching (protégée, layout préservé).
#
# 1) PC (PowerShell) :
#    scp "C:\Users\gheza\Downloads\GMT20260927-180245_Recording_1366x768.mp4" ubuntu@164.132.46.191:~/f01-coaching.mp4
#
# 2) VPS :
#    export VIDEO_SRC=~/f01-coaching.mp4
#    export REF=cursor/module-f01-video-691a
#    curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-F01-COACHING-FROM-FILE.sh" -o /tmp/d-f01c.sh
#    bash /tmp/d-f01c.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/module-f01-video-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
VIDEO_NAME="${VIDEO_NAME:-f01-coaching.mp4}"
CAPTION="${CAPTION:-TORINVEST · La Forge — Replay coaching F1}"
SECTION_TITLE="${SECTION_TITLE:-Replay coaching — Live}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_URL="/course/videos/$VIDEO_NAME"
VIDEO_SRC="${VIDEO_SRC:-}"
# 1 = recompress léger (recommandé pour Zoom ~177 Mo) ; 0 = copie si déjà H.264
FORCE_COMPRESS="${FORCE_COMPRESS:-1}"

echo "======== F01 COACHING VIDEO ($REF) ========"
mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$APP_DIR/public/css"

if [[ -z "$VIDEO_SRC" ]]; then
  shopt -s nullglob
  for c in \
    "$PUBLIC_VID" \
    "$HOME/f01-coaching.mp4" \
    "$HOME/f01-coaching.mkv" \
    "$HOME/GMT20260927-180245_Recording_1366x768.mp4" \
    "$HOME"/GMT*_Recording*.mp4 \
    "$HOME/Downloads/GMT20260927-180245_Recording_1366x768.mp4" \
    "$HOME"/Downloads/GMT*_Recording*.mp4 \
    "/tmp/f01-coaching.mp4" \
    "/tmp/GMT20260927-180245_Recording_1366x768.mp4"
  do
    if [[ -f "$c" ]] && [[ $(stat -c%s "$c" 2>/dev/null || echo 0) -gt 500000 ]]; then
      VIDEO_SRC="$c"
      break
    fi
  done
  shopt -u nullglob
fi

if [[ -z "$VIDEO_SRC" || ! -f "$VIDEO_SRC" ]]; then
  echo "ERREUR : recording coaching introuvable."
  echo "  scp \"C:\\Users\\gheza\\Downloads\\GMT20260927-180245_Recording_1366x768.mp4\" ubuntu@164.132.46.191:~/f01-coaching.mp4"
  echo "  export VIDEO_SRC=~/f01-coaching.mp4 REF=$REF"
  echo "  bash /tmp/d-f01c.sh"
  exit 1
fi

echo "Source : $VIDEO_SRC ($(ls -lh "$VIDEO_SRC" | awk '{print $5}'))"
WORK="/tmp/forge-f01-coach-$$"
mkdir -p "$WORK"

vcodec=""; acodec=""
if command -v ffprobe >/dev/null 2>&1; then
  vcodec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  acodec=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  echo "Codecs : vidéo=$vcodec audio=$acodec"
fi

# Zoom MP4 souvent déjà H.264 — on recompress léger (scale≤1280, veryfast) pour le web
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
  "$APP_DIR/private/course/f01-marches.html" \
  "$APP_DIR/public/course/f01-marches.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -z "$HTML" ]] && HTML=$(find "$APP_DIR" -type f -iname 'f01-marches.html' 2>/dev/null | head -1 || true)
[[ -n "$HTML" && -f "$HTML" ]] || { echo "ERREUR: f01-marches.html introuvable"; exit 1; }

echo "HTML : $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-f01coach-$STAMP"

python3 - "$HTML" "$VIDEO_URL" "$CAPTION" "$SECTION_TITLE" <<'PY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url = sys.argv[2]
caption = sys.argv[3]
section_title = sys.argv[4]
text = html_path.read_text(encoding="utf-8")

ms, me = "<!-- FORGE_F01_COACHING_START -->", "<!-- FORGE_F01_COACHING_END -->"

block = f"""{ms}
<section class="forge-lesson-video-slot" data-video-id="f01-coaching" id="f01-coaching">
  <h2 class="forge-lesson-video-heading">{section_title}</h2>
  <p class="forge-lesson-video-lead">Replay du live coaching — session Premium.</p>
  <figure class="forge-lesson-video forge-lesson-video--protected" id="f01-video-coaching">
    <video controls playsinline preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false">
      <source src="{video_url}" type="video/mp4" />
      Votre navigateur ne lit pas la vidéo HTML5.
    </video>
    <figcaption>{caption}</figcaption>
  </figure>
</section>
{me}"""

# Retirer ancien bloc coaching
text = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", text, flags=re.S)
text = re.sub(
    r'<(?:section|div)[^>]*(?:id=["\']f01-coaching["\']|data-video-id=["\']f01-coaching["\'])[^>]*>.*?</(?:section|div)\s*>',
    "",
    text,
    flags=re.I | re.S,
)

action = None

# 1) Placeholder dédié
m = re.search(
    r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\']f01-coaching["\'][^>]*)>(.*?)</\1\s*>',
    text,
    flags=re.I | re.S,
)
if m:
    tag, attrs = m.group(1), m.group(2)
    # garder wrapper, injecter figure seule
    inner = f"""{ms}
  <h2 class="forge-lesson-video-heading">{section_title}</h2>
  <p class="forge-lesson-video-lead">Replay du live coaching — session Premium.</p>
  <figure class="forge-lesson-video forge-lesson-video--protected" id="f01-video-coaching">
    <video controls playsinline preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false">
      <source src="{video_url}" type="video/mp4" />
      Votre navigateur ne lit pas la vidéo HTML5.
    </video>
    <figcaption>{caption}</figcaption>
  </figure>
{me}"""
    text = text[: m.start()] + f"<{tag}{attrs}>\n{inner}\n</{tag}>" + text[m.end() :]
    action = "remplacé data-video-id=f01-coaching"
else:
    # 2) Juste après la vidéo microstructure (slot F1 principal)
    m1 = re.search(r"<!--\s*FORGE_F01_VIDEO_END\s*-->", text, flags=re.I)
    if m1:
        text = text[: m1.end()] + "\n\n" + block + "\n" + text[m1.end() :]
        action = "inséré après FORGE_F01_VIDEO_END"
    else:
        mfig = re.search(
            r'(<figure[^>]*id=["\']f01-video["\'][^>]*>.*?</figure>)',
            text,
            flags=re.I | re.S,
        )
        if mfig:
            text = text[: mfig.end()] + "\n\n" + block + "\n" + text[mfig.end() :]
            action = "inséré après #f01-video"
        else:
            # 3) Avant le bloc REPLAY ÉLITE / cas EURUSD
            mcas = re.search(
                r'(<(?:section|div|article)[^>]*>[\s\S]{0,120}?REPLAY\s*ÉLITE)',
                text,
                flags=re.I,
            )
            if mcas:
                text = text[: mcas.start()] + block + "\n\n" + text[mcas.start() :]
                action = "inséré avant REPLAY ÉLITE"
            else:
                print("ERREUR: point d'insertion coaching introuvable", file=sys.stderr)
                sys.exit(2)

if "forge-lesson-video.css" not in text and "</head>" in text:
    text = text.replace(
        "</head>",
        '  <link rel="stylesheet" href="/css/forge-lesson-video.css?v=f01c" />\n</head>',
        1,
    )
else:
    text = re.sub(
        r'forge-lesson-video\.css(\?v=[^"]*)?',
        "forge-lesson-video.css?v=f01c",
        text,
        count=1,
    )

text = re.sub(r"\n{4,}", "\n\n\n", text)
html_path.write_text(text, encoding="utf-8")
print("Action :", action)
if "f01-coaching.mp4" not in text and video_url.split("/")[-1] not in text:
    print("ERREUR: mp4 coaching absent du HTML", file=sys.stderr)
    sys.exit(3)
PY

# CSS headings légers (sans casser la grille)
python3 - "$APP_DIR/public/css/forge-lesson-video.css" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
base = p.read_text(encoding="utf-8") if p.exists() else ""
extra = """
.forge-lesson-video-heading {
  color: var(--gold, #ffd700);
  font-size: 1.05rem;
  margin: 1.25rem 0 0.35rem;
}
.forge-lesson-video-lead {
  color: #9aa3b2;
  font-size: 0.9rem;
  margin: 0 0 0.65rem;
}
"""
if "forge-lesson-video-heading" not in base:
    p.write_text(base.rstrip() + "\n" + extra, encoding="utf-8")
    print("CSS: headings coaching ajoutés")
PY

if [[ "$HTML" == "$APP_DIR/private/course/f01-marches.html" ]]; then
  mkdir -p "$APP_DIR/public/course"
  cp -a "$HTML" "$APP_DIR/public/course/f01-marches.html"
  echo "Sync public HTML"
fi

rm -rf "$WORK"

echo ""
grep -n "f01-coaching\|FORGE_F01_COACHING\|f01-video-coaching" "$HTML" | head -20
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"
echo ""
echo "OK — replay coaching F1 branché."
echo "→ Hard refresh : https://app.torinvest-trading.com/course/f01-marches.html"
echo "======== DONE ========"
