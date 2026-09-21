#!/usr/bin/env bash
# Module 0 — 2ᵉ vidéo PROTÉGÉE (comme la 1ʳᵉ) : MP4 derrière /course/videos/ + nodownload.
#
# Source YouTube (téléchargée une fois sur le VPS, puis servie en privé) :
#   https://www.youtube.com/watch?v=9-n-CyHiEIo
#
# Ne PAS laisser d'iframe YouTube publique dans la leçon (téléchargeable).
#
# Sur le VPS :
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/DEPLOY-MODULE0-VIDEO2-PROTECTED.sh | bash
# Avant merge :
#   REF=cursor/module0-yt2-691a curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-MODULE0-VIDEO2-PROTECTED.sh" | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
YT_ID="${YT_ID:-9-n-CyHiEIo}"
YT_URL="https://www.youtube.com/watch?v=${YT_ID}"
VIDEO_NAME="${VIDEO_NAME:-module-0-metier.mp4}"
CAPTION="${CAPTION:-TORINVEST · La Forge — Métier du trader (vidéo 2)}"

PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_URL="/course/videos/$VIDEO_NAME"
WORK="/tmp/forge-yt2-$$"

echo "======== MODULE0 VIDEO2 PROTÉGÉE ($REF) ========"
echo "APP=$APP_DIR"
echo "YT=$YT_URL → $VIDEO_NAME"

mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$WORK"

# ——— 1) Obtenir le MP4 (skip download si déjà là) ———
need_dl=1
if [[ -f "$PUBLIC_VID" ]] && [[ $(stat -c%s "$PUBLIC_VID" 2>/dev/null || echo 0) -gt 1000000 ]]; then
  echo "OK — MP4 déjà présent : $(ls -lh "$PUBLIC_VID" | awk '{print $5}')"
  need_dl=0
fi

if [[ "$need_dl" -eq 1 ]]; then
  echo "==> Téléchargement YouTube → MP4 (yt-dlp)…"
  if ! command -v yt-dlp >/dev/null 2>&1; then
    echo "Install yt-dlp…"
    sudo curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    sudo chmod a+rx /usr/local/bin/yt-dlp
  fi
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "ERREUR: ffmpeg requis (H.264)."
    exit 1
  fi

  yt-dlp -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best" \
    --merge-output-format mp4 \
    -o "$WORK/raw.%(ext)s" \
    "$YT_URL"

  RAW_FILE=$(ls -1 "$WORK"/raw.* 2>/dev/null | head -1)
  if [[ -z "$RAW_FILE" || ! -f "$RAW_FILE" ]]; then
    echo "ERREUR: téléchargement YouTube échoué"
    exit 1
  fi

  echo "==> Normalise H.264 + AAC (+faststart) pour navigateurs…"
  ffmpeg -y -i "$RAW_FILE" \
    -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 \
    -c:a aac -b:a 160k -ac 2 -movflags +faststart \
    "$WORK/out.mp4"

  cp -a "$WORK/out.mp4" "$PUBLIC_VID"
  chmod 644 "$PUBLIC_VID"
  echo "OK public : $(ls -lh "$PUBLIC_VID" | awk '{print $5}')"
fi

# Sync private (serveur lit souvent private/course/videos)
cp -a "$PUBLIC_VID" "$PRIVATE_VID"
chmod 644 "$PRIVATE_VID"
echo "OK private : $(ls -lh "$PRIVATE_VID" | awk '{print $5}')"

# ——— 2) Injecter / remplacer dans intro-metier.html ———
HTML=""
for candidate in \
  "$APP_DIR/private/course/intro-metier.html" \
  "$APP_DIR/public/course/intro-metier.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
if [[ -z "$HTML" ]]; then
  HTML=$(find "$APP_DIR" -type f -iname 'intro-metier.html' 2>/dev/null | head -1 || true)
fi
if [[ -z "$HTML" || ! -f "$HTML" ]]; then
  echo "ERREUR: intro-metier.html introuvable"
  exit 1
fi

echo "Cible HTML : $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-vid2prot-$STAMP"

python3 - "$HTML" "$VIDEO_URL" "$CAPTION" <<'PY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url = sys.argv[2]
caption = sys.argv[3]
text = html_path.read_text(encoding="utf-8")

marker_start = "<!-- FORGE_MODULE0_VIDEO2_START -->"
marker_end = "<!-- FORGE_MODULE0_VIDEO2_END -->"

# Lecteur protégé (même modèle que vidéo 1)
block = f"""<!-- FORGE_MODULE0_VIDEO2_START -->
<figure class="forge-lesson-video forge-lesson-video--protected" id="module0-video-2">
  <h2 style="color:var(--gold,#ffd700);font-size:1.05rem;margin:1.5rem 0 0.65rem;text-align:center;">
    Vidéo 2 — Métier du trader
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
    Votre navigateur ne lit pas la vidéo HTML5.
  </video>
  <figcaption style="text-align:center;color:#9aa3b2;font-size:0.9rem;margin-top:0.5rem;margin-bottom:1.25rem;">
    {caption}
  </figcaption>
</figure>
<!-- FORGE_MODULE0_VIDEO2_END -->"""

# Retirer tout ancien embed YouTube module0-video-2 / VIDEO2
text = re.sub(
    re.escape(marker_start) + r".*?" + re.escape(marker_end),
    block,
    text,
    count=1,
    flags=re.S,
)
if marker_start not in text:
    # pas encore de marqueurs : insérer après vidéo 1
    m1 = re.search(r"<!--\s*FORGE_MODULE0_VIDEO_END\s*-->", text, flags=re.I)
    if m1:
        idx = m1.end()
        text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
        action = "inséré après vidéo 1"
    else:
        mvid = re.search(
            r'(<figure[^>]*id="module0-video"[^>]*>.*?</figure>)',
            text,
            flags=re.I | re.S,
        )
        if mvid:
            idx = mvid.end()
            text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
            action = "inséré après #module0-video"
        else:
            mh = re.search(r"(<h1\b[^>]*>.*?</h1>)", text, flags=re.I | re.S)
            if not mh:
                print("ERREUR: insertion impossible", file=sys.stderr)
                sys.exit(2)
            idx = mh.end()
            text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
            action = "inséré après h1"
else:
    action = "remplacé (marqueurs VIDEO2)"

# Purge iframe youtube orpheline liée à cet ID si encore présente hors marqueurs
text = re.sub(
    r'<iframe[^>]+youtube\.com/embed/9-n-CyHiEIo[^>]*>.*?</iframe>',
    "",
    text,
    flags=re.I | re.S,
)
# Purge section yt précédente (id module0-video-2 avec iframe)
text = re.sub(
    r'<section[^>]*id="module0-video-2"[^>]*>.*?</section>',
    "",
    text,
    flags=re.I | re.S,
)
# Si on a purgé la section, s'assurer que le block marqueurs est bien là
if marker_start not in text:
    m1 = re.search(r"<!--\s*FORGE_MODULE0_VIDEO_END\s*-->", text, flags=re.I)
    if m1:
        text = text[: m1.end()] + "\n\n" + block + "\n" + text[m1.end() :]
        action += " + réinséré après purge iframe"

html_path.write_text(text, encoding="utf-8")
print("Action HTML :", action)
PY

# Sync public HTML mirror
PRIV_HTML="$APP_DIR/private/course/intro-metier.html"
PUB_HTML="$APP_DIR/public/course/intro-metier.html"
if [[ "$HTML" == "$PRIV_HTML" ]]; then
  mkdir -p "$(dirname "$PUB_HTML")"
  cp -a "$HTML" "$PUB_HTML"
  echo "Sync public HTML"
fi

# ——— 3) CSS anti-download léger (tous lecteurs protégés) ———
CSS_SNIP="$APP_DIR/public/css/forge-lesson-video.css"
curl -fsSL "$RAW/la-forge/css/forge-lesson-video.css" -o "$CSS_SNIP" 2>/dev/null || cat > "$CSS_SNIP" <<'CSS'
/* Lecteurs leçon protégés — pas de bouton download navigateur */
.forge-lesson-video--protected video,
.forge-lesson-video video {
  -webkit-user-select: none;
  user-select: none;
}
.forge-lesson-video--protected video::-webkit-media-controls-download-button {
  display: none !important;
}
.forge-lesson-video--protected video::-internal-media-controls-download-button {
  display: none !important;
}
CSS

# Injecter link CSS dans intro-metier si absent
python3 - "$HTML" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
t = p.read_text(encoding="utf-8")
link = '<link rel="stylesheet" href="/css/forge-lesson-video.css" />'
if "forge-lesson-video.css" not in t:
    if "</head>" in t:
        t = t.replace("</head>", "  " + link + "\n</head>", 1)
    p.write_text(t, encoding="utf-8")
    print("CSS link injecté")
else:
    print("CSS link déjà présent")
# sync public
priv = Path.home() / "torinvest-formation/private/course/intro-metier.html"
pub = Path.home() / "torinvest-formation/public/course/intro-metier.html"
if p.resolve() == priv.resolve() and pub.parent.exists():
    pub.write_text(t, encoding="utf-8")
PY

rm -rf "$WORK"

echo ""
echo "Vérif :"
grep -n "module-0-metier.mp4\|FORGE_MODULE0_VIDEO2\|youtube.com/embed/9-n-CyHiEIo\|controlslist" "$HTML" | head -20
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"
echo ""
echo "Anon doit être bloqué :"
echo "  curl -sI https://app.torinvest-trading.com/course/videos/module-0-metier.mp4 | head -3"
echo "→ https://app.torinvest-trading.com/course/intro-metier.html"
echo "======== DONE ========"
