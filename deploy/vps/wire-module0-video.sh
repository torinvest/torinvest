#!/usr/bin/env bash
# Branche la vidéo Module 0 (socle) dans intro-metier.html sur le VPS.
#
# Sur ce serveur les leçons HTML sont dans private/course/ (pas public/course/).
# Vidéo attendue :
#   ~/torinvest-formation/public/course/videos/module-0-socle.mp4
#   URL : /course/videos/module-0-socle.mp4
#
# Usage :
#   bash deploy/vps/wire-module0-video.sh
#   bash deploy/vps/wire-module0-video.sh /home/ubuntu/torinvest-formation
set -euo pipefail

APP_DIR="${1:-$HOME/torinvest-formation}"
PUBLIC_COURSE="$APP_DIR/public/course"
PRIVATE_COURSE="$APP_DIR/private/course"
VIDEO_FILE="$PUBLIC_COURSE/videos/module-0-socle.mp4"
VIDEO_URL="/course/videos/module-0-socle.mp4"
MARKER_START="<!-- FORGE_MODULE0_VIDEO_START -->"
MARKER_END="<!-- FORGE_MODULE0_VIDEO_END -->"

echo "==> APP_DIR=$APP_DIR"

if [[ ! -f "$VIDEO_FILE" ]]; then
  echo "ERREUR : vidéo introuvable : $VIDEO_FILE"
  exit 1
fi
echo "OK vidéo (public) : $(ls -lh "$VIDEO_FILE" | awk '{print $5}')"

# Les leçons sont servies depuis private/course/ → le mp4 doit aussi y être
# sinon /course/videos/... résout private/course/videos/ (404 / écran noir).
PRIVATE_VIDEO_DIR="$PRIVATE_COURSE/videos"
PRIVATE_VIDEO_FILE="$PRIVATE_VIDEO_DIR/module-0-socle.mp4"
mkdir -p "$PRIVATE_VIDEO_DIR"
if [[ ! -f "$PRIVATE_VIDEO_FILE" ]] || ! cmp -s "$VIDEO_FILE" "$PRIVATE_VIDEO_FILE" 2>/dev/null; then
  echo "Sync vidéo → private/course/videos/…"
  cp -a "$VIDEO_FILE" "$PRIVATE_VIDEO_FILE"
fi
chmod 644 "$PRIVATE_VIDEO_FILE" 2>/dev/null || true
echo "OK vidéo (private) : $(ls -lh "$PRIVATE_VIDEO_FILE" | awk '{print $5}')"

# Ordre de priorité : private/course (réel sur VPS) puis public/course
HTML=""
for candidate in \
  "$PRIVATE_COURSE/intro-metier.html" \
  "$PUBLIC_COURSE/intro-metier.html"
do
  if [[ -f "$candidate" ]]; then
    HTML="$candidate"
    break
  fi
done

if [[ -z "$HTML" ]]; then
  echo "Recherche élargie…"
  FOUND=$(find "$APP_DIR" -type f -iname 'intro-metier.html' 2>/dev/null | head -5 || true)
  if [[ -n "$FOUND" ]]; then
    HTML=$(echo "$FOUND" | head -1)
  fi
fi

if [[ -z "$HTML" || ! -f "$HTML" ]]; then
  echo "ERREUR : intro-metier.html introuvable."
  echo "Attendu : $PRIVATE_COURSE/intro-metier.html"
  ls -la "$PRIVATE_COURSE" 2>/dev/null | head -30 || true
  exit 1
fi

echo "Cible HTML : $HTML"

STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-video-$STAMP"
echo "Backup : $HTML.bak-video-$STAMP"

python3 - "$HTML" "$VIDEO_URL" <<'PY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url = sys.argv[2]
text = html_path.read_text(encoding="utf-8")

marker_start = "<!-- FORGE_MODULE0_VIDEO_START -->"
marker_end = "<!-- FORGE_MODULE0_VIDEO_END -->"
block = f"""<!-- FORGE_MODULE0_VIDEO_START -->
<figure class="forge-lesson-video" id="module0-video">
  <video
    controls
    playsinline
    preload="metadata"
    controlslist="nodownload"
    style="width:100%;max-width:960px;border-radius:12px;background:#000;display:block;margin:1.25rem auto;"
  >
    <source src="{video_url}" type="video/mp4" />
    Votre navigateur ne lit pas la vidéo HTML5.
  </video>
  <figcaption style="text-align:center;color:#9aa3b2;font-size:0.9rem;margin-top:0.5rem;">
    TORINVEST · La Forge — Le socle avant la technique
  </figcaption>
</figure>
<!-- FORGE_MODULE0_VIDEO_END -->"""

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
    patterns = [
        r'<figure[^>]*class="[^"]*forge-lesson-video[^"]*"[^>]*>.*?</figure>',
        r'<div[^>]*class="[^"]*(?:lesson-video|video-slot|module-video|video-placeholder|video-embed)[^"]*"[^>]*>.*?</div>',
        r'<video\b[^>]*>.*?</video>',
        r'<!--\s*(?:VIDEO|VIDÉO|EMPLACEMENT[_\s-]*VIDEO)[^>]*-->',
    ]
    replaced = False
    for pat in patterns:
        if re.search(pat, text, flags=re.I | re.S):
            text = re.sub(pat, block, text, count=1, flags=re.I | re.S)
            replaced = True
            action = "remplacé via placeholder / <video> existant"
            break
    if not replaced:
        m = re.search(r"(<h1\b[^>]*>.*?</h1>)", text, flags=re.I | re.S)
        if m:
            idx = m.end()
            text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
            action = "inséré après le premier <h1>"
        else:
            m2 = re.search(r"(<main\b[^>]*>)", text, flags=re.I)
            if m2:
                idx = m2.end()
                text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
                action = "inséré après <main>"
            else:
                m3 = re.search(r"(<body\b[^>]*>)", text, flags=re.I)
                if not m3:
                    print("ERREUR : point d'insertion introuvable", file=sys.stderr)
                    sys.exit(2)
                idx = m3.end()
                text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
                action = "inséré après <body>"

html_path.write_text(text, encoding="utf-8")
print("Action :", action)
PY

# Si le serveur sert aussi depuis public/course, synchroniser
if [[ "$HTML" == "$PRIVATE_COURSE/intro-metier.html" ]]; then
  mkdir -p "$PUBLIC_COURSE"
  # Ne pas écraser un public différent sans backup ; sync miroir pour cohérence URL /course/
  if [[ -f "$PUBLIC_COURSE/intro-metier.html" ]]; then
    cp -a "$PUBLIC_COURSE/intro-metier.html" "$PUBLIC_COURSE/intro-metier.html.bak-before-sync-$STAMP"
  fi
  cp -a "$HTML" "$PUBLIC_COURSE/intro-metier.html"
  echo "Sync public : $PUBLIC_COURSE/intro-metier.html"
fi

echo
echo "Vérif :"
grep -n "module-0-socle.mp4\|FORGE_MODULE0_VIDEO" "$HTML" | head -10
echo
echo "URL : https://app.torinvest-trading.com/course/intro-metier.html"
echo "Hard refresh (Ctrl+Shift+R)."
