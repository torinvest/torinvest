#!/usr/bin/env bash
# HOTFIX F2 — meme pattern que HOTFIX-F01-VIDEO-LAYOUT.sh :
#   1) MP4 deja en place (pas de re-transcode)
#   2) Python INLINE (aucun curl de .py → plus de chmod inject-f02.py)
#   3) Purge le player colle sous h1
#   4) Reinjecte dans un wrapper data-video-id AVANT Exercice / Evaluation
#
# VPS :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/module-f2-video-slot-f01-691a/deploy/vps/HOTFIX-F02-VIDEO-NOW.sh" -o /tmp/hf02.sh
#   bash /tmp/hf02.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
VIDEO_NAME="${VIDEO_NAME:-f02-xauusd.mp4}"
VIDEO_URL="/course/videos/$VIDEO_NAME"
CAPTION="${CAPTION:-TORINVEST La Forge - F2 XAUUSD - anatomie de lor}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"

echo "======== HOTFIX F02 VIDEO SLOT (inline, comme F1) ========"

# ——— MP4 ———
if [[ ! -f "$PUBLIC_VID" ]] || [[ $(stat -c%s "$PUBLIC_VID" 2>/dev/null || echo 0) -lt 500000 ]]; then
  SRC=""
  for c in "$HOME/f02-xauusd.mp4" "$PRIVATE_VID" "/tmp/f02-xauusd.mp4" "$HOME"/F2*.mp4; do
    [[ -f "$c" ]] || continue
    [[ $(stat -c%s "$c" 2>/dev/null || echo 0) -gt 500000 ]] || continue
    SRC="$c"; break
  done
  [[ -n "$SRC" ]] || { echo "ERREUR: ~/f02-xauusd.mp4 introuvable"; exit 1; }
  mkdir -p "$(dirname "$PUBLIC_VID")" "$(dirname "$PRIVATE_VID")"
  cp -a "$SRC" "$PUBLIC_VID"
  echo "MP4 copie depuis $SRC"
fi
mkdir -p "$(dirname "$PUBLIC_VID")" "$(dirname "$PRIVATE_VID")"
chmod 644 "$PUBLIC_VID"
cp -a "$PUBLIC_VID" "$PRIVATE_VID"
chmod 644 "$PRIVATE_VID"
echo "OK MP4 : $(ls -lh "$PUBLIC_VID" | awk '{print $5}')"

# ——— HTML ———
HTML=""
for candidate in \
  "$APP_DIR/private/course/f02-xauusd.html" \
  "$APP_DIR/public/course/f02-xauusd.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -z "$HTML" ]] && HTML=$(find "$APP_DIR" -type f -iname 'f02-xauusd.html' 2>/dev/null | head -1 || true)
[[ -n "$HTML" && -f "$HTML" ]] || { echo "ERREUR: f02-xauusd.html introuvable"; exit 1; }

F01=""
for c in \
  "$APP_DIR/private/course/f01-marches.html" \
  "$APP_DIR/public/course/f01-marches.html"
do
  [[ -f "$c" ]] && F01="$c" && break
done

echo "HTML : $HTML"
echo "F01  : ${F01:-ABSENT}"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-f02slot-$STAMP"

# CSS (best-effort)
mkdir -p "$APP_DIR/public/css"
if [[ ! -f "$APP_DIR/public/css/forge-lesson-video.css" ]]; then
  curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/la-forge/css/forge-lesson-video.css" \
    -o "$APP_DIR/public/css/forge-lesson-video.css" || true
fi

# ——— Patch INLINE (copie du pattern F1 LAYOUT) ———
python3 - "$HTML" "${F01:-/dev/null}" "$VIDEO_URL" "$CAPTION" <<'PY'
import re
import sys
from pathlib import Path

html_path = Path(sys.argv[1])
f01_path = Path(sys.argv[2])
video_url = sys.argv[3]
caption = sys.argv[4]

text = html_path.read_text(encoding="utf-8", errors="replace")
f01 = f01_path.read_text(encoding="utf-8", errors="replace") if f01_path.is_file() else ""

ms, me = "<!-- FORGE_F02_VIDEO_START -->", "<!-- FORGE_F02_VIDEO_END -->"

# Meme markup interieur que F1 LAYOUT (figure seule)
inner = f"""{ms}
<figure class="forge-lesson-video forge-lesson-video--protected" id="f02-video">
  <video
    controls
    playsinline
    preload="metadata"
    controlslist="nodownload noplaybackrate"
    disablepictureinpicture
    oncontextmenu="return false"
  >
    <source src="{video_url}" type="video/mp4" />
    Votre navigateur ne lit pas la video HTML5.
  </video>
  <figcaption>{caption}</figcaption>
</figure>
{me}"""

# Wrapper = classes F1 si dispo, sinon media-box dashed (ce que F1 utilise en live)
wrap_open = '<div class="media-box dashed" data-video-id="f02-anatomie">'
wrap_close = "</div>"
m_f01 = re.search(
    r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\']f01-microstructure["\'][^>]*)>',
    f01,
    flags=re.I,
)
if m_f01:
    tag, attrs = m_f01.group(1), m_f01.group(2)
    attrs = re.sub(
        r'data-video-id=["\'][^"\']+["\']',
        'data-video-id="f02-anatomie"',
        attrs,
        count=1,
        flags=re.I,
    )
    attrs = re.sub(r'\sId=["\'][^"\']*["\']', "", attrs, flags=re.I)
    wrap_open = f"<{tag}{attrs}>"
    wrap_close = f"</{tag}>"
    print("F1 wrapper:", wrap_open[:160])
else:
    print("F1 absent — wrapper media-box dashed par defaut")

# --- 1) PURGE total de tout player F2 (y compris sous h1) ---
text = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", text, flags=re.S)
text = re.sub(
    r'<figure[^>]*id=["\']f02-video["\'][^>]*>.*?</figure>',
    "",
    text,
    flags=re.I | re.S,
)
# section / div slots F2 (id, data-video-id, class)
text = re.sub(
    r'<section[^>]*(?:id=["\']f02-video[^"\']*["\']|data-video-id=["\']f02-[^"\']*["\']|class=["\'][^"\']*forge-lesson-video-slot[^"\']*["\'])[^>]*>[\s\S]*?</section\s*>',
    "",
    text,
    flags=re.I,
)
text = re.sub(
    r'<(div|aside|article)(\s[^>]*(?:data-video-id=["\']f02-[^"\']*["\']|id=["\']f02-video[^"\']*["\'])[^>]*)>[\s\S]*?</\1\s*>',
    "",
    text,
    flags=re.I,
)
# titres Video F2 orphelins
text = re.sub(
    r'<h2[^>]*>\s*(?:Video|Vidéo)\s*[—\-]\s*(?:XAUUSD|Anatomie)[^<]*</h2>\s*',
    "",
    text,
    flags=re.I,
)
text = re.sub(
    r'<section[^>]*id=["\']f02-video-section["\'][^>]*>[\s\S]*?</section\s*>',
    "",
    text,
    flags=re.I,
)
text = re.sub(r"\n{3,}", "\n\n", text)

section = (
    "\n"
    '<section class="forge-lesson-video-section" id="f02-video-section">\n'
    '<h2 class="forge-lesson-video-heading">Video — Anatomie de l or en conditions reelles</h2>\n'
    '<p class="forge-lesson-video-lead">Sessions, volatilite et correlations sur XAUUSD.</p>\n'
    f"{wrap_open}\n{inner}\n{wrap_close}\n"
    "</section>\n"
)

action = None

# --- 2) Insert AVANT les ancres milieu/fin de lecon (structure F2 live) ---
anchors = [
    r"(<h[2-4][^>]*>\s*Exercice\s+sur\s+chart[^<]*</h[2-4]>)",
    r"(<h[2-4][^>]*>\s*Exercices\s+pratiques[^<]*</h[2-4]>)",
    r"(<h[2-4][^>]*>\s*Exercice[^<]*</h[2-4]>)",
    r"(<h[2-4][^>]*>\s*[ÉE]valuation[^<]*</h[2-4]>)",
    r"(<h[2-4][^>]*>\s*Cas\s+XAUUSD[^<]*</h[2-4]>)",
    r"(<h[2-4][^>]*>\s*Quiz[^<]*</h[2-4]>)",
]
for pat in anchors:
    m = re.search(pat, text, flags=re.I)
    if m:
        text = text[: m.start()] + section + text[m.start() :]
        action = f"avant {re.sub(r'<[^>]+>', '', m.group(1)).strip()[:50]}"
        break

if action is None:
    # apres Objectifs du module (+ contenu jusqu'au prochain h2)
    m = re.search(
        r"(<h[2-4][^>]*>\s*Objectifs[^<]*</h[2-4]>)([\s\S]{0,3000}?)(?=<h[2-4]\b)",
        text,
        flags=re.I,
    )
    if m:
        text = text[: m.end()] + section + text[m.end() :]
        action = "apres Objectifs du module"
    else:
        print("ERREUR: aucun point d insertion (Exercice / Evaluation / Objectifs)", file=sys.stderr)
        for i, line in enumerate(text.splitlines(), 1):
            if re.search(r"<h[1-3]|Objectifs|Exercice|Evaluation|Cas XAU", line, flags=re.I):
                print(f"  L{i}: {line[:140]}", file=sys.stderr)
        sys.exit(2)

if "forge-lesson-video.css" not in text and "</head>" in text:
    text = text.replace(
        "</head>",
        '  <link rel="stylesheet" href="/css/forge-lesson-video.css?v=f02d" />\n</head>',
        1,
    )
else:
    text = re.sub(
        r'forge-lesson-video\.css(\?v=[^"]*)?',
        "forge-lesson-video.css?v=f02d",
        text,
        count=1,
    )

text = re.sub(r"\n{4,}", "\n\n\n", text)
html_path.write_text(text, encoding="utf-8")
print("Action :", action)

# Guards
if "f02-xauusd.mp4" not in text:
    print("ERREUR: mp4 absent apres patch", file=sys.stderr)
    sys.exit(3)
if text.count('id="f02-video"') != 1:
    print("WARN: nb #f02-video =", text.count('id="f02-video"'), file=sys.stderr)

m = re.search(r"</h1\s*>", text, flags=re.I)
if m and "f02-xauusd.mp4" in text[m.end() : m.end() + 500]:
    print("ERREUR: video encore trop proche du h1", file=sys.stderr)
    sys.exit(3)

vid = text.find("f02-xauusd.mp4")
ex = re.search(r"<h[2-4][^>]*>\s*Exercice", text, flags=re.I)
if ex and vid > ex.start():
    print("WARN: video apres Exercice", file=sys.stderr)
else:
    print("OK: video avant Exercice / milieu de lecon")
print("OK placement F2")
PY

if [[ "$HTML" == "$APP_DIR/private/course/f02-xauusd.html" ]]; then
  mkdir -p "$APP_DIR/public/course"
  cp -a "$HTML" "$APP_DIR/public/course/f02-xauusd.html"
  echo "Sync public HTML"
fi

echo ""
echo "=== VERIF ==="
grep -nE 'f02-xauusd.mp4|FORGE_F02_VIDEO|f02-video|data-video-id="f02|Exercice|Objectifs' "$HTML" | head -40
echo ""
echo "OK — video F2 dans le slot (inline, comme F1)."
echo "-> Ctrl+Shift+R : https://app.torinvest-trading.com/course/f02-xauusd.html"
echo "======== DONE ========"
