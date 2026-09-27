#!/usr/bin/env bash
# Déplace la vidéo F1 vers le placeholder prévu :
#   data-video-id="f01-microstructure"
#   (« Vidéo — Microstructure en conditions réelles »)
# Sans re-transcoder (utilise le MP4 déjà en place).
#
#   REF=cursor/module-f01-video-691a curl -fsSL \
#     https://raw.githubusercontent.com/torinvest/torinvest/cursor/module-f01-video-691a/deploy/vps/HOTFIX-F01-VIDEO-SLOT.sh \
#     -o /tmp/hf01.sh && bash /tmp/hf01.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
VIDEO_NAME="${VIDEO_NAME:-f01-marches.mp4}"
VIDEO_URL="/course/videos/$VIDEO_NAME"
CAPTION="${CAPTION:-TORINVEST · La Forge — F1 Participants & microstructure}"
TITLE="${TITLE:-Vidéo — Microstructure en conditions réelles}"

PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"

echo "======== HOTFIX F01 VIDEO SLOT ========"

if [[ ! -f "$PUBLIC_VID" ]] && [[ -f "$PRIVATE_VID" ]]; then
  mkdir -p "$(dirname "$PUBLIC_VID")"
  cp -a "$PRIVATE_VID" "$PUBLIC_VID"
fi
if [[ ! -f "$PUBLIC_VID" ]] || [[ $(stat -c%s "$PUBLIC_VID" 2>/dev/null || echo 0) -lt 500000 ]]; then
  echo "ERREUR: $PUBLIC_VID manquant — lance d’abord DEPLOY-F01-VIDEO-FROM-FILE.sh"
  exit 1
fi

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
cp -a "$HTML" "$HTML.bak-f01slot-$STAMP"

# CSS
mkdir -p "$APP_DIR/public/css"
if [[ ! -f "$APP_DIR/public/css/forge-lesson-video.css" ]]; then
  curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/la-forge/css/forge-lesson-video.css" \
    -o "$APP_DIR/public/css/forge-lesson-video.css" || true
fi

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

player = f"""<!-- FORGE_F01_VIDEO_START -->
<figure class="forge-lesson-video forge-lesson-video--protected" id="f01-video" data-video-id="f01-microstructure">
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
  <figcaption style="text-align:center;color:#9aa3b2;font-size:0.9rem;margin-top:0.5rem;margin-bottom:0.75rem;">
    {caption}
  </figcaption>
</figure>
<!-- FORGE_F01_VIDEO_END -->"""

# 1) Retirer tout ancien bloc vidéo F1 mal placé (souvent juste après <h1>)
text2 = re.sub(
    re.escape(marker_start) + r".*?" + re.escape(marker_end),
    "",
    text,
    flags=re.S,
)
text2 = re.sub(
    r'<figure[^>]*id=["\']f01-video["\'][^>]*>.*?</figure>',
    "",
    text2,
    flags=re.I | re.S,
)
# Titre orphelin injecté au-dessus (ancien script)
text2 = re.sub(
    r'<h2[^>]*>\s*Vidéo\s*[—\-]\s*Participants\s*&amp;\s*microstructure\s*</h2>\s*',
    "",
    text2,
    flags=re.I,
)

action = None

# 2a) Remplacer le placeholder data-video-id="f01-microstructure"
#     (bloc « Intégration vidéo à venir »)
ph = re.search(
    r'(<(?:div|section|aside|figure|article)[^>]*data-video-id=["\']f01-microstructure["\'][^>]*>)(.*?)(</(?:div|section|aside|figure|article)>)',
    text2,
    flags=re.I | re.S,
)
if ph:
    text2 = text2[: ph.start()] + player + text2[ph.end() :]
    action = "remplacé data-video-id=f01-microstructure"
else:
    # 2b) Bloc texte « Intégration vidéo à venir » près de f01-microstructure
    ph2 = re.search(
        r'(<[^>]*>[^<]*Int[ée]gration vid[ée]o [àa] venir[^<]*</[^>]+>)',
        text2,
        flags=re.I,
    )
    if ph2 and "f01-microstructure" in text2[max(0, ph2.start() - 800) : ph2.end() + 200]:
        # remonter au conteneur parent le plus proche avec class video / dashed
        start = text2.rfind("<", 0, ph2.start())
        # élargir : chercher ouverture div avant
        open_m = None
        for m in re.finditer(r"<(div|section|figure|article)\b[^>]*>", text2[: ph2.start()], flags=re.I):
            open_m = m
        if open_m:
            # fermeture correspondante simplifiée : prochain closing tag du même type après
            tag = open_m.group(1)
            close = re.search(rf"</{tag}\s*>", text2[ph2.end() :], flags=re.I)
            if close:
                end = ph2.end() + close.end()
                text2 = text2[: open_m.start()] + player + text2[end:]
                action = "remplacé bloc Intégration vidéo à venir"
    if action is None:
        # 2c) Après le titre de section prévu
        mtit = re.search(
            r"(Vidéo\s*[—\-]\s*Microstructure en conditions r[ée]elles.*?</h[2-4]>)",
            text2,
            flags=re.I | re.S,
        )
        if mtit:
            # insérer après le sous-titre éventuel (p suivant)
            after = mtit.end()
            p = re.match(r"\s*<p\b[^>]*>.*?</p>", text2[after:], flags=re.I | re.S)
            if p:
                after = after + p.end()
            text2 = text2[:after] + "\n" + player + "\n" + text2[after:]
            action = "inséré sous titre Microstructure en conditions réelles"

if action is None:
    print("ERREUR: placeholder f01-microstructure introuvable dans le HTML", file=sys.stderr)
    # dump indices utiles
    for needle in ("f01-microstructure", "Intégration vidéo", "conditions réelles", "FORGE_F01"):
        print(f"  contains {needle!r}: {needle.lower() in text2.lower()}", file=sys.stderr)
    sys.exit(2)

if "forge-lesson-video.css" not in text2 and "</head>" in text2:
    text2 = text2.replace(
        "</head>",
        '  <link rel="stylesheet" href="/css/forge-lesson-video.css" />\n</head>',
        1,
    )

# Nettoyage espaces multiples laissés par les suppressions
text2 = re.sub(r"\n{4,}", "\n\n\n", text2)

html_path.write_text(text2, encoding="utf-8")
print("Action :", action)
if "f01-marches.mp4" not in text2:
    print("ERREUR: mp4 absent après patch", file=sys.stderr)
    sys.exit(3)
if "Intégration vidéo à venir" in text2 and 'data-video-id="f01-microstructure"' in text2:
    # ok si le texte reste ailleurs ; fail si le placeholder box est encore là
    if re.search(r'data-video-id=["\']f01-microstructure["\'][^>]*>[\s\S]{0,400}?Int[ée]gration vid[ée]o', text2, flags=re.I):
        print("WARN: placeholder encore présent", file=sys.stderr)
PY

if [[ "$HTML" == "$APP_DIR/private/course/f01-marches.html" ]]; then
  mkdir -p "$APP_DIR/public/course"
  cp -a "$HTML" "$APP_DIR/public/course/f01-marches.html"
  echo "Sync public HTML"
fi

echo ""
echo "Vérif :"
grep -n "f01-marches.mp4\|f01-microstructure\|FORGE_F01_VIDEO\|Intégration vidéo" "$HTML" | head -30
echo ""
echo "OK — vidéo dans le slot prévu."
echo "→ Hard refresh : https://app.torinvest-trading.com/course/f01-marches.html"
echo "======== DONE ========"
