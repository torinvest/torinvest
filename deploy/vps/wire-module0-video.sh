#!/usr/bin/env bash
# Branche la vidéo Module 0 (socle) dans la leçon intro sur le VPS.
# Prérequis : ~/torinvest-formation/public/course/videos/module-0-socle.mp4
#
# Usage :
#   bash deploy/vps/wire-module0-video.sh
#   bash deploy/vps/wire-module0-video.sh /home/ubuntu/torinvest-formation
set -euo pipefail

APP_DIR="${1:-$HOME/torinvest-formation}"
COURSE="$APP_DIR/public/course"
VIDEO_REL="/course/videos/module-0-socle.mp4"
VIDEO_FILE="$COURSE/videos/module-0-socle.mp4"
MARKER_START="<!-- FORGE_MODULE0_VIDEO_START -->"
MARKER_END="<!-- FORGE_MODULE0_VIDEO_END -->"

echo "==> APP_DIR=$APP_DIR"

if [[ ! -f "$VIDEO_FILE" ]]; then
  echo "ERREUR : vidéo introuvable : $VIDEO_FILE"
  exit 1
fi
echo "OK vidéo : $(ls -lh "$VIDEO_FILE" | awk '{print $5, $9}')"

echo
echo "==> Contenu public/course (html) :"
find "$COURSE" -maxdepth 2 -type f -name '*.html' 2>/dev/null | sort | head -80 || true

echo
echo "==> Recherche intro-metier / module 0 sur le serveur :"
# Chemins candidats connus + recherche limitée
CANDIDATES=()
while IFS= read -r f; do
  CANDIDATES+=("$f")
done < <(
  {
    find "$COURSE" -maxdepth 3 -type f \( -iname '*intro*metier*.html' -o -iname 'intro.html' -o -iname '*module*0*.html' -o -iname '*metier*.html' \) 2>/dev/null
    find "$APP_DIR" -maxdepth 4 -type f -iname 'intro-metier.html' 2>/dev/null
    find "$HOME/backups" -maxdepth 3 -type f -iname 'intro-metier.html' 2>/dev/null
    find /var/www -maxdepth 5 -type f -iname 'intro-metier.html' 2>/dev/null
  } | sort -u
)

if [[ ${#CANDIDATES[@]} -eq 0 ]]; then
  echo
  echo "ERREUR : aucune leçon Module 0 trouvée (intro-metier.html absent)."
  echo
  echo "Les HTML des modules sont PRIVÉS et doivent vivre dans :"
  echo "  $COURSE/*.html"
  echo "Actuellement il n'y a souvent que index.html (catalogue)."
  echo
  echo "À faire :"
  echo "  1) Restaurer une sauvegarde course-*.tar.gz si tu en as :"
  echo "       ls -lh ~/backups/torinvest/course-*.tar.gz 2>/dev/null"
  echo "       # exemple :"
  echo "       # tar -tzf ~/backups/torinvest/course-XXXX.tar.gz | head"
  echo "       # tar -xzf ~/backups/torinvest/course-XXXX.tar.gz -C $APP_DIR/public"
  echo "  2) Ou recopier les leçons depuis ta machine locale vers public/course/"
  echo
  echo "Puis relance ce script."
  exit 1
fi

echo "Candidats :"
printf '  %s\n' "${CANDIDATES[@]}"

# Préférence : public/course/intro-metier.html
HTML=""
for f in "${CANDIDATES[@]}"; do
  if [[ "$f" == "$COURSE/intro-metier.html" ]]; then
    HTML="$f"
    break
  fi
done
if [[ -z "$HTML" ]]; then
  HTML="${CANDIDATES[0]}"
fi

echo
echo "Cible HTML : $HTML"

# Si trouvé hors de public/course, copier vers l'emplacement canonique
CANON="$COURSE/intro-metier.html"
if [[ "$HTML" != "$CANON" ]]; then
  mkdir -p "$COURSE"
  if [[ ! -f "$CANON" ]]; then
    echo "Copie vers emplacement canonique : $CANON"
    cp -a "$HTML" "$CANON"
  fi
  HTML="$CANON"
fi

STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-video-$STAMP"
echo "Backup : $HTML.bak-video-$STAMP"

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
        r'<div[^>]*class="[^"]*(?:lesson-video|video-slot|module-video|video-placeholder)[^"]*"[^>]*>.*?</div>',
        r'<video\b[^>]*>.*?</video>',
        r'<!--\s*(?:VIDEO|VIDÉO|EMPLACEMENT[_\s-]*VIDEO)[^>]*-->',
    ]
    replaced = False
    for pat in patterns:
        if re.search(pat, text, flags=re.I | re.S):
            text = re.sub(pat, block, text, count=1, flags=re.I | re.S)
            replaced = True
            action = "remplacé via placeholder/video existant"
            break
    if not replaced:
        m = re.search(r"(<h1\b[^>]*>.*?</h1>)", text, flags=re.I | re.S)
        if m:
            idx = m.end()
            text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
            action = "inséré après le premier <h1>"
        else:
            m2 = re.search(r"(<body\b[^>]*>)", text, flags=re.I)
            if not m2:
                print("ERREUR : point d'insertion introuvable", file=sys.stderr)
                sys.exit(2)
            idx = m2.end()
            text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
            action = "inséré après <body>"

html_path.write_text(text, encoding="utf-8")
print("Action :", action)
PY

echo
echo "Vérif :"
grep -n "module-0-socle.mp4\|FORGE_MODULE0_VIDEO" "$HTML" | head -10
echo
echo "URL : https://app.torinvest-trading.com/course/intro-metier.html"
echo "Hard refresh (Ctrl+Shift+R)."
