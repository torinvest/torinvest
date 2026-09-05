#!/usr/bin/env bash
# Branche la vidéo Module 0 (socle) dans intro-metier.html sur le VPS.
# Prérequis : fichier déjà uploadé :
#   ~/torinvest-formation/public/course/videos/module-0-socle.mp4
#
# Usage (sur le VPS) :
#   bash ~/torinvest-formation/deploy/vps/wire-module0-video.sh
#   # ou depuis le repo cloné :
#   bash deploy/vps/wire-module0-video.sh
set -euo pipefail

APP_DIR="${1:-$HOME/torinvest-formation}"
COURSE="$APP_DIR/public/course"
HTML="$COURSE/intro-metier.html"
VIDEO_REL="/course/videos/module-0-socle.mp4"
VIDEO_FILE="$COURSE/videos/module-0-socle.mp4"
MARKER_START="<!-- FORGE_MODULE0_VIDEO_START -->"
MARKER_END="<!-- FORGE_MODULE0_VIDEO_END -->"

if [[ ! -f "$VIDEO_FILE" ]]; then
  echo "ERREUR : vidéo introuvable : $VIDEO_FILE"
  echo "Upload d'abord le mp4 puis relance."
  exit 1
fi

if [[ ! -f "$HTML" ]]; then
  echo "ERREUR : leçon introuvable : $HTML"
  ls -la "$COURSE"/*.html 2>/dev/null | head -20 || true
  exit 1
fi

SIZE=$(du -h "$VIDEO_FILE" | awk '{print $1}')
echo "OK vidéo : $VIDEO_FILE ($SIZE)"
echo "Cible HTML : $HTML"

# Backup
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-video-$STAMP"
echo "Backup : $HTML.bak-video-$STAMP"

VIDEO_BLOCK=$(cat <<EOF
$MARKER_START
<figure class="forge-lesson-video" id="module0-video">
  <video
    controls
    playsinline
    preload="metadata"
    controlslist="nodownload"
    poster=""
    style="width:100%;max-width:960px;border-radius:12px;background:#000;display:block;margin:1.25rem auto;"
  >
    <source src="$VIDEO_REL" type="video/mp4" />
    Votre navigateur ne lit pas la vidéo HTML5.
  </video>
  <figcaption style="text-align:center;color:#9aa3b2;font-size:0.9rem;margin-top:0.5rem;">
    TORINVEST · La Forge — Le socle avant la technique
  </figcaption>
</figure>
$MARKER_END
EOF
)

python3 - "$HTML" <<'PY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
text = html_path.read_text(encoding="utf-8")

marker_start = "<!-- FORGE_MODULE0_VIDEO_START -->"
marker_end = "<!-- FORGE_MODULE0_VIDEO_END -->"
block = """<!-- FORGE_MODULE0_VIDEO_START -->
<figure class="forge-lesson-video" id="module0-video">
  <video
    controls
    playsinline
    preload="metadata"
    controlslist="nodownload"
    poster=""
    style="width:100%;max-width:960px;border-radius:12px;background:#000;display:block;margin:1.25rem auto;"
  >
    <source src="/course/videos/module-0-socle.mp4" type="video/mp4" />
    Votre navigateur ne lit pas la vidéo HTML5.
  </video>
  <figcaption style="text-align:center;color:#9aa3b2;font-size:0.9rem;margin-top:0.5rem;">
    TORINVEST · La Forge — Le socle avant la technique
  </figcaption>
</figure>
<!-- FORGE_MODULE0_VIDEO_END -->"""

# 1) Remplace un bloc déjà marqué
if marker_start in text and marker_end in text:
    text = re.sub(
        re.escape(marker_start) + r".*?" + re.escape(marker_end),
        block,
        text,
        count=1,
        flags=re.S,
    )
    action = "remplacé (marqueurs existants)"
else:
    # 2) Remplace un <video> / placeholder existant dans la leçon
    patterns = [
        r'<figure[^>]*class="[^"]*forge-lesson-video[^"]*"[^>]*>.*?</figure>',
        r'<div[^>]*class="[^"]*(?:lesson-video|video-slot|module-video|video-placeholder)[^"]*"[^>]*>.*?</div>',
        r'<video\b[^>]*>.*?</video>',
        r'<!--\s*(?:VIDEO|VIDÉO|EMPLACEMENT[_\s-]*VIDEO)[^>]*-->',
    ]
    replaced = False
    for pat in patterns:
        if re.search(pat, text, flags=re.I | re.S):
            text = re.sub(pat, block, text, count=1, flags=re.I | re.S)
            replaced = True
            action = f"remplacé via motif {pat[:40]}…"
            break

    if not replaced:
        # 3) Insère après le premier <h1>…</h1> (emplacement naturel en tête de leçon)
        m = re.search(r"(<h1\b[^>]*>.*?</h1>)", text, flags=re.I | re.S)
        if m:
            idx = m.end()
            text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
            action = "inséré après le premier <h1>"
        else:
            # 4) Fallback : après <body>
            m2 = re.search(r"(<body\b[^>]*>)", text, flags=re.I)
            if not m2:
                print("ERREUR : impossible de trouver un point d'insertion", file=sys.stderr)
                sys.exit(2)
            idx = m2.end()
            text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
            action = "inséré après <body>"

html_path.write_text(text, encoding="utf-8")
print("Action :", action)
PY

echo
echo "Vérif HTML :"
grep -n "module-0-socle.mp4\|FORGE_MODULE0_VIDEO" "$HTML" | head -10
echo
echo "URL membre (connecté Premium) :"
echo "  https://app.torinvest-trading.com/course/intro-metier.html"
echo "  https://app.torinvest-trading.com/course/videos/module-0-socle.mp4"
echo
echo "Hard refresh navigateur (Ctrl+Shift+R)."
