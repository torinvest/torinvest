#!/usr/bin/env bash
# HOTFIX — branche la vidéo F2 dans f02-xauusd.html (une commande VPS).
#
# AVANT (sur ton PC PowerShell) :
#   scp "E:\TORINVEST\live torinvest\F2 XAUUSD — anatomie de l'or.mp4" ubuntu@164.132.46.191:~/f02-xauusd.mp4
#
# PUIS sur le VPS :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/module-f2-xauusd-video-691a/deploy/vps/HOTFIX-F02-VIDEO-NOW.sh" | bash
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/module-f2-xauusd-video-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
VIDEO_NAME="f02-xauusd.mp4"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_URL="/course/videos/$VIDEO_NAME"
CAPTION="TORINVEST · La Forge — F2 XAUUSD — anatomie de l'or"
TITLE="Vidéo — XAUUSD anatomie de l'or"

echo "############################################################"
echo "#  HOTFIX F2 VIDEO — anatomie de l'or                     #"
echo "#  ref: $REF                                              #"
echo "############################################################"

mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$APP_DIR/public/css" "$APP_DIR/public/course"

# ——— Source vidéo ———
VIDEO_SRC="${VIDEO_SRC:-}"
if [[ -z "$VIDEO_SRC" ]]; then
  for c in \
    "$HOME/f02-xauusd.mp4" \
    "$HOME/f02-xauusd.mkv" \
    "$HOME/f02-xauusd.webm" \
    "$PUBLIC_VID" \
    "$PRIVATE_VID" \
    "/tmp/f02-xauusd.mp4" \
    "$HOME/F2"*.mp4
  do
    [[ -f "$c" ]] || continue
    sz=$(stat -c%s "$c" 2>/dev/null || echo 0)
    if [[ "$sz" -gt 500000 ]]; then
      VIDEO_SRC="$c"
      break
    fi
  done
fi

if [[ -z "${VIDEO_SRC:-}" || ! -f "$VIDEO_SRC" ]]; then
  echo ""
  echo "ÉCHEC: fichier ~/f02-xauusd.mp4 introuvable sur le VPS."
  echo "Depuis ton PC (PowerShell) :"
  echo "  scp \"E:\\TORINVEST\\live torinvest\\F2 XAUUSD — anatomie de l'or.mp4\" ubuntu@164.132.46.191:~/f02-xauusd.mp4"
  echo "Puis relance ce HOTFIX."
  exit 1
fi

echo "Source : $VIDEO_SRC ($(ls -lh "$VIDEO_SRC" | awk '{print $5}'))"

# ——— Transcode / copie ———
WORK="/tmp/forge-f02-hotfix-$$"
mkdir -p "$WORK"
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
  echo "==> Transcode H.264…"
  ffmpeg -y -i "$VIDEO_SRC" \
    -vf "fps=30,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 26 \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart -fps_mode cfr \
    "$WORK/out.mp4"
  cp -a "$WORK/out.mp4" "$PUBLIC_VID"
else
  if command -v ffmpeg >/dev/null 2>&1 && ffmpeg -y -i "$VIDEO_SRC" -c copy -movflags +faststart "$WORK/out.mp4" 2>/dev/null; then
    cp -a "$WORK/out.mp4" "$PUBLIC_VID"
  else
    cp -a "$VIDEO_SRC" "$PUBLIC_VID"
  fi
fi
chmod 644 "$PUBLIC_VID"
cp -a "$PUBLIC_VID" "$PRIVATE_VID"
chmod 644 "$PRIVATE_VID"
echo "OK MP4 : $(ls -lh "$PUBLIC_VID" | awk '{print $5}')"

# CSS
curl -fsSL "$RAW/la-forge/css/forge-lesson-video.css" -o "$APP_DIR/public/css/forge-lesson-video.css" || true

# HTML
HTML=""
for candidate in \
  "$APP_DIR/private/course/f02-xauusd.html" \
  "$APP_DIR/public/course/f02-xauusd.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -z "$HTML" ]] && HTML=$(find "$APP_DIR" -type f -iname 'f02-xauusd.html' 2>/dev/null | head -1 || true)
[[ -n "$HTML" && -f "$HTML" ]] || { echo "ERREUR: f02-xauusd.html introuvable"; exit 1; }

echo "HTML : $HTML"
echo "--- diagnostic slot ---"
rg -n "data-video|Intégration|Vidéo|youtube|FORGE_F02|f02-video|<h1|<main" "$HTML" | head -40 || true
echo "-----------------------"

STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-f02hotfix-$STAMP"

python3 - "$HTML" "$VIDEO_URL" "$CAPTION" "$TITLE" <<'PY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url, caption, title = sys.argv[2], sys.argv[3], sys.argv[4]
text = html_path.read_text(encoding="utf-8")

ms, me = "<!-- FORGE_F02_VIDEO_START -->", "<!-- FORGE_F02_VIDEO_END -->"
block = f"""{ms}
<section class="forge-lesson-video-slot" data-video-id="f02-anatomie" id="f02-video-slot">
<figure class="forge-lesson-video forge-lesson-video--protected" id="f02-video">
  <h2 style="color:var(--gold,#ffd700);font-size:1.05rem;margin:1rem 0 0.65rem;text-align:center;">{title}</h2>
  <video controls playsinline preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false" style="width:100%;max-width:960px;border-radius:12px;background:#000;display:block;margin:0 auto;">
    <source src="{video_url}" type="video/mp4" />
    Votre navigateur ne lit pas la vidéo HTML5.
  </video>
  <figcaption style="text-align:center;color:#9aa3b2;font-size:0.9rem;margin-top:0.5rem;margin-bottom:1rem;">{caption}</figcaption>
</figure>
</section>
{me}"""

# purge anciens
text = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", text, flags=re.S)
text = re.sub(r'<figure[^>]*id=["\']f02-video["\'][^>]*>.*?</figure>', "", text, flags=re.I | re.S)
text = re.sub(r'<section[^>]*(?:id=["\']f02-video-slot["\']|data-video-id=["\']f02-[^"\']*["\'])[^>]*>.*?</section>', "", text, flags=re.I | re.S)

action = None

# A) data-video-id contenant f02
m = re.search(
    r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\'][^"\']*f02[^"\']*["\'][^>]*)>(.*?)</\1\s*>',
    text, flags=re.I | re.S,
)
if m:
    text = text[: m.start()] + f"<{m.group(1)}{m.group(2)}>\n{block}\n</{m.group(1)}>" + text[m.end() :]
    action = "slot data-video-id f02"

# B) n'importe quel data-video-id encore vide / placeholder
if not action:
    m = re.search(
        r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\'][^"\']+["\'][^>]*)>([^<]{0,400}?Int[ée]gration\s+vid[ée]o[\s\S]{0,200}?)</\1\s*>',
        text, flags=re.I,
    )
    if m:
        text = text[: m.start()] + f"<{m.group(1)}{m.group(2)}>\n{block}\n</{m.group(1)}>" + text[m.end() :]
        action = "placeholder Intégration vidéo (data-video-id)"

# C) paragraphe / div « Intégration vidéo à venir »
if not action:
    m = re.search(
        r'<(p|div|section|aside)([^>]*)>\s*Int[ée]gration\s+vid[ée]o[^<]{0,80}</\1\s*>',
        text, flags=re.I,
    )
    if m:
        text = text[: m.start()] + block + text[m.end() :]
        action = "remplacé texte Intégration vidéo"

# D) après titre h1 / h2 contenant anatomie ou XAUUSD
if not action:
    m = re.search(
        r'(<(?:h1|h2)[^>]*>[^<]*(?:anatomie|XAUUSD|XAU)[^<]*</(?:h1|h2)\s*>)',
        text, flags=re.I,
    )
    if m:
        text = text[: m.end()] + "\n\n" + block + "\n" + text[m.end() :]
        action = "après titre anatomie/XAUUSD"

# E) après premier h1
if not action:
    m = re.search(r"(</h1\s*>)", text, flags=re.I)
    if m:
        text = text[: m.end()] + "\n\n" + block + "\n" + text[m.end() :]
        action = "après premier h1"

# F) début de main / .lesson / .content
if not action:
    m = re.search(r'(<(?:main|div)[^>]*(?:class=["\'][^"\']*(?:lesson|content|container)[^"\']*["\'])[^>]*>)', text, flags=re.I)
    if m:
        text = text[: m.end()] + "\n\n" + block + "\n" + text[m.end() :]
        action = "dans main/lesson"
    else:
        print("ERREUR: aucun point d'insertion", file=sys.stderr)
        # dump hints
        for pat in ("data-video", "Intégration", "<h1", "<main", "youtube"):
            print(f"  has {pat}:", pat.lower() in text.lower(), file=sys.stderr)
        sys.exit(2)

if "forge-lesson-video.css" not in text and "</head>" in text:
    text = text.replace("</head>", '  <link rel="stylesheet" href="/css/forge-lesson-video.css?v=f02" />\n</head>', 1)

html_path.write_text(text, encoding="utf-8")
print("Action :", action)
PY

# sync public
if [[ "$HTML" == "$APP_DIR/private/course/f02-xauusd.html" ]]; then
  cp -a "$HTML" "$APP_DIR/public/course/f02-xauusd.html"
  echo "Sync → public/course/f02-xauusd.html"
fi

rm -rf "$WORK"

echo ""
echo "=== VÉRIF ==="
grep -n "f02-xauusd.mp4\|FORGE_F02_VIDEO\|f02-video\|controlslist" "$HTML" | head -20
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"
grep -q "f02-xauusd.mp4" "$HTML" || { echo "ÉCHEC: mp4 absent du HTML"; exit 3; }
[[ $(stat -c%s "$PUBLIC_VID") -gt 500000 ]] || { echo "ÉCHEC: MP4 trop petit"; exit 3; }

echo ""
echo "OK — vidéo F2 dans le module."
echo "→ Ctrl+Shift+R : https://app.torinvest-trading.com/course/f02-xauusd.html"
echo "======== DONE ========"
