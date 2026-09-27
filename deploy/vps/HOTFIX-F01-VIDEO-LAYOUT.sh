#!/usr/bin/env bash
# Corrige la mise en page F1 : vidéo DANS le placeholder (contenu intérieur),
# comme Module 0 — sans casser la grille lesson-layout / agrandir la page.
#
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/module-f01-video-691a/deploy/vps/HOTFIX-F01-VIDEO-LAYOUT.sh \
#     -o /tmp/hf01-layout.sh && bash /tmp/hf01-layout.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
VIDEO_NAME="${VIDEO_NAME:-f01-marches.mp4}"
VIDEO_URL="/course/videos/$VIDEO_NAME"
CAPTION="${CAPTION:-TORINVEST · La Forge — F1 Participants & microstructure}"
REF="${REF:-cursor/module-f01-video-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"

echo "======== HOTFIX F01 VIDEO LAYOUT ========"

if [[ ! -f "$PUBLIC_VID" ]] && [[ -f "$PRIVATE_VID" ]]; then
  mkdir -p "$(dirname "$PUBLIC_VID")"
  cp -a "$PRIVATE_VID" "$PUBLIC_VID"
fi
[[ -f "$PUBLIC_VID" ]] || { echo "ERREUR: $PUBLIC_VID manquant"; exit 1; }

HTML=""
for candidate in \
  "$APP_DIR/private/course/f01-marches.html" \
  "$APP_DIR/public/course/f01-marches.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -n "$HTML" && -f "$HTML" ]] || { echo "ERREUR: f01-marches.html introuvable"; exit 1; }

echo "HTML : $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-f01layout-$STAMP"

# Restaurer une version propre si possible (placeholder encore intact)
RESTORE=""
# Plus ancien bak-f01vid = avant toute injection (idéal)
if compgen -G "$HTML.bak-f01vid-*" > /dev/null; then
  RESTORE=$(ls -1t "$HTML".bak-f01vid-* 2>/dev/null | tail -1 || true)
fi
# Sinon un bak qui contient encore le placeholder intact
if [[ -z "$RESTORE" ]]; then
  for b in $(ls -1t "$HTML".bak-* 2>/dev/null || true); do
    if grep -q 'data-video-id="f01-microstructure"' "$b" 2>/dev/null \
      && grep -qi 'Intégration vidéo à venir\|Integration video' "$b" 2>/dev/null \
      && ! grep -q 'f01-marches.mp4' "$b" 2>/dev/null; then
      RESTORE="$b"
      break
    fi
  done
fi

if [[ -n "$RESTORE" && -f "$RESTORE" ]]; then
  echo "Restore propre depuis : $RESTORE"
  cp -a "$RESTORE" "$HTML"
else
  echo "Pas de bak propre — nettoyage in-place du HTML actuel"
fi

# CSS contenu (évite d’élargir la colonne)
mkdir -p "$APP_DIR/public/css"
curl -fsSL "$RAW/la-forge/css/forge-lesson-video.css" -o "$APP_DIR/public/css/forge-lesson-video.css" || true

python3 - "$HTML" "$VIDEO_URL" "$CAPTION" <<'PY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url = sys.argv[2]
caption = sys.argv[3]
text = html_path.read_text(encoding="utf-8")

marker_start = "<!-- FORGE_F01_VIDEO_START -->"
marker_end = "<!-- FORGE_F01_VIDEO_END -->"

# Player SANS max-width:960px inline (casse la grille 2 colonnes).
# Contenu uniquement — le wrapper data-video-id garde ses classes.
inner = f"""{marker_start}
<figure class="forge-lesson-video forge-lesson-video--protected" id="f01-video">
  <video
    controls
    playsinline
    preload="metadata"
    controlslist="nodownload noplaybackrate"
    disablepictureinpicture
    oncontextmenu="return false"
  >
    <source src="{video_url}" type="video/mp4" />
    Votre navigateur ne lit pas la vidéo HTML5.
  </video>
  <figcaption>{caption}</figcaption>
</figure>
{marker_end}"""

# 1) Retirer tout ancien player F1 (mal placé sous h1 ou figure orpheline)
text = re.sub(re.escape(marker_start) + r".*?" + re.escape(marker_end), "", text, flags=re.S)
text = re.sub(
    r'<figure[^>]*(?:id=["\']f01-video["\']|data-video-id=["\']f01-microstructure["\'])[^>]*>.*?</figure>',
    "",
    text,
    flags=re.I | re.S,
)
text = re.sub(
    r'<h2[^>]*>\s*Vidéo\s*[—\-]\s*Participants\s*&amp;\s*microstructure\s*</h2>\s*',
    "",
    text,
    flags=re.I,
)

action = None

# 2) Remplacer UNIQUEMENT le contenu intérieur du wrapper data-video-id
#    (on conserve la balise ouvrante + fermante = classes / grille intactes)
m = re.search(
    r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\']f01-microstructure["\'][^>]*)>(.*?)</\1\s*>',
    text,
    flags=re.I | re.S,
)
if m:
    tag = m.group(1)
    attrs = m.group(2)
    replacement = f"<{tag}{attrs}>\n{inner}\n</{tag}>"
    text = text[: m.start()] + replacement + text[m.end() :]
    action = f"contenu intérieur <{tag} data-video-id=f01-microstructure>"
else:
    # Fallback : après le titre de section, sans toucher au layout
    mtit = re.search(
        r"(<h[2-4][^>]*>\s*Vidéo\s*[—\-]\s*Microstructure en conditions r[ée]elles\s*</h[2-4]>)",
        text,
        flags=re.I | re.S,
    )
    if mtit:
        after = mtit.end()
        p = re.match(r"\s*<p\b[^>]*>.*?</p>", text[after:], flags=re.I | re.S)
        if p:
            after = after + p.end()
        # wrapper local pour ne pas casser la grille
        wrap = (
            f'\n<div class="forge-lesson-video-slot" data-video-id="f01-microstructure">\n'
            f"{inner}\n</div>\n"
        )
        text = text[:after] + wrap + text[after:]
        action = "inséré sous titre (wrapper slot)"
    else:
        print("ERREUR: slot f01-microstructure introuvable", file=sys.stderr)
        for needle in ("f01-microstructure", "Intégration vidéo", "conditions réelles"):
            print(f"  {needle!r}: {needle.lower() in text.lower()}", file=sys.stderr)
        sys.exit(2)

if "forge-lesson-video.css" not in text and "</head>" in text:
    text = text.replace(
        "</head>",
        '  <link rel="stylesheet" href="/css/forge-lesson-video.css?v=f01" />\n</head>',
        1,
    )
else:
    # cache-bust
    text = re.sub(
        r'forge-lesson-video\.css(\?v=[^"]*)?',
        "forge-lesson-video.css?v=f01",
        text,
        count=1,
    )

text = re.sub(r"\n{4,}", "\n\n\n", text)
html_path.write_text(text, encoding="utf-8")
print("Action :", action)

# Sanity : pas de max-width:960 forcé ; mp4 présent ; un seul player
if "max-width:960px" in text and "f01-video" in text:
    print("WARN: max-width:960px encore présent sur un style — vérifier")
if text.count('id="f01-video"') != 1:
    print("WARN: nombre de #f01-video =", text.count('id="f01-video"'))
if "f01-marches.mp4" not in text:
    print("ERREUR: mp4 absent", file=sys.stderr)
    sys.exit(3)
PY

# Enrichir le CSS (containment layout)
python3 - "$APP_DIR/public/css/forge-lesson-video.css" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
base = p.read_text(encoding="utf-8") if p.exists() else ""
extra = """
/* Contenance layout — ne pas élargir .lesson-layout */
.forge-lesson-video,
.forge-lesson-video-slot,
[data-video-id="f01-microstructure"] {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 0.75rem 0;
  box-sizing: border-box;
  min-width: 0;
}
.forge-lesson-video video,
.forge-lesson-video--protected video {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 12px;
  background: #000;
  box-sizing: border-box;
}
.forge-lesson-video figcaption {
  text-align: center;
  color: #9aa3b2;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}
.lesson-layout .forge-lesson-video,
.lesson-layout .forge-lesson-video-slot,
.lesson-layout [data-video-id="f01-microstructure"] {
  grid-column: auto;
  max-width: 100%;
  min-width: 0;
}
"""
if "ne pas élargir .lesson-layout" not in base:
    p.write_text(base.rstrip() + "\n" + extra, encoding="utf-8")
    print("CSS: containment ajouté")
else:
    print("CSS: containment déjà présent")
PY

if [[ "$HTML" == "$APP_DIR/private/course/f01-marches.html" ]]; then
  mkdir -p "$APP_DIR/public/course"
  cp -a "$HTML" "$APP_DIR/public/course/f01-marches.html"
  echo "Sync public HTML"
fi

echo ""
echo "Vérif :"
grep -n "f01-marches.mp4\|f01-microstructure\|FORGE_F01\|max-width:960\|lesson-layout" "$HTML" | head -40
echo ""
echo "OK — vidéo dans le slot, layout préservé."
echo "→ Hard refresh (Ctrl+Shift+R) : https://app.torinvest-trading.com/course/f01-marches.html"
echo "======== DONE ========"
