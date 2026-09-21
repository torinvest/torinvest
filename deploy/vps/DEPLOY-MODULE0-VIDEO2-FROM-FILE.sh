#!/usr/bin/env bash
# Module 0 — vidéo 2 PROTÉGÉE sans yt-dlp (YouTube bloque souvent le VPS).
#
# 1) Sur ton PC, télécharge la vidéo (YouTube → MP4) puis upload :
#    scp module-0-metier.mp4 ubuntu@164.132.46.191:~/torinvest-formation/public/course/videos/
#
# 2) Sur le VPS (IMPORTANT : export AVANT le pipe, sinon VIDEO_SRC est ignoré) :
#    export VIDEO_SRC=~/module-0-metier.mkv
#    curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/ad585c4/deploy/vps/DEPLOY-MODULE0-VIDEO2-FROM-FILE.sh | bash
#
# Ou :
#    bash <(curl -fsSL …/DEPLOY-MODULE0-VIDEO2-FROM-FILE.sh)
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
# SHA figé = script présent même si pas encore mergé dans main
REF="${REF:-ad585c4}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
VIDEO_NAME="${VIDEO_NAME:-module-0-metier.mp4}"
CAPTION="${CAPTION:-TORINVEST · La Forge — Métier du trader (vidéo 2)}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_URL="/course/videos/$VIDEO_NAME"
VIDEO_SRC="${VIDEO_SRC:-}"

echo "======== MODULE0 VIDEO2 FROM FILE ($REF) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$APP_DIR/public/css"

# ——— Trouver le fichier source (mp4 ou mkv déjà uploadé) ———
if [[ -z "$VIDEO_SRC" ]]; then
  for c in \
    "$PUBLIC_VID" \
    "$HOME/module-0-metier.mkv" \
    "$HOME/module-0-metier.mp4" \
    "$HOME/$VIDEO_NAME" \
    "$HOME/Downloads/$VIDEO_NAME" \
    "/tmp/$VIDEO_NAME" \
    "/tmp/module-0-metier.mkv"
  do
    if [[ -f "$c" ]] && [[ $(stat -c%s "$c" 2>/dev/null || echo 0) -gt 500000 ]]; then
      VIDEO_SRC="$c"
      break
    fi
  done
fi

if [[ -z "$VIDEO_SRC" || ! -f "$VIDEO_SRC" ]]; then
  echo "ERREUR : fichier vidéo introuvable (mp4/mkv)."
  echo ""
  echo "YouTube bloque yt-dlp sur ce VPS. Fais plutôt :"
  echo "  1) Upload depuis ton PC :"
  echo "     scp \"E:\\TORINVEST\\live torinvest\\fichier.mkv\" ubuntu@164.132.46.191:~/module-0-metier.mkv"
  echo "  2) Relance :"
  echo "     export VIDEO_SRC=~/module-0-metier.mkv"
  echo "     curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/ad585c4/deploy/vps/DEPLOY-MODULE0-VIDEO2-FROM-FILE.sh | bash"
  exit 1
fi

echo "Source : $VIDEO_SRC ($(ls -lh "$VIDEO_SRC" | awk '{print $5}'))"

# ——— Normalise H.264 si besoin (sinon copie) ———
WORK="/tmp/forge-vid2-file-$$"
mkdir -p "$WORK"
need_transcode=1
if command -v ffprobe >/dev/null 2>&1; then
  vcodec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  acodec=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  echo "Codecs détectés : vidéo=$vcodec audio=$acodec"
  if [[ "$vcodec" == "h264" ]] && { [[ "$acodec" == "aac" ]] || [[ "$acodec" == "mp3" ]] || [[ -z "$acodec" ]]; }; then
    need_transcode=0
  fi
fi

if [[ "$need_transcode" -eq 1 ]]; then
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "ERREUR: ffmpeg requis pour convertir en H.264"
    exit 1
  fi
  echo "==> Transcode H.264 + AAC..."
  ffmpeg -y -i "$VIDEO_SRC" \
    -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 \
    -c:a aac -b:a 160k -ac 2 -movflags +faststart \
    "$WORK/out.mp4"
  cp -a "$WORK/out.mp4" "$PUBLIC_VID"
else
  echo "==> Copie directe (+faststart si possible)..."
  if command -v ffmpeg >/dev/null 2>&1; then
    if ffmpeg -y -i "$VIDEO_SRC" -c copy -movflags +faststart "$WORK/out.mp4"; then
      cp -a "$WORK/out.mp4" "$PUBLIC_VID"
    else
      cp -a "$VIDEO_SRC" "$PUBLIC_VID"
    fi
  else
    cp -a "$VIDEO_SRC" "$PUBLIC_VID"
  fi
fi
chmod 644 "$PUBLIC_VID"
cp -a "$PUBLIC_VID" "$PRIVATE_VID"
chmod 644 "$PRIVATE_VID"
echo "OK : $(ls -lh "$PUBLIC_VID" | awk '{print $5}')"

# CSS protection (ASCII comment only)
curl -fsSL "$RAW/la-forge/css/forge-lesson-video.css" -o "$APP_DIR/public/css/forge-lesson-video.css" || true

# HTML inject
HTML=""
for candidate in \
  "$APP_DIR/private/course/intro-metier.html" \
  "$APP_DIR/public/course/intro-metier.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -z "$HTML" ]] && HTML=$(find "$APP_DIR" -type f -iname 'intro-metier.html' 2>/dev/null | head -1 || true)
if [[ -z "$HTML" || ! -f "$HTML" ]]; then
  echo "ERREUR: intro-metier.html introuvable"
  exit 1
fi

echo "HTML : $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-vid2file-$STAMP"

python3 - "$HTML" "$VIDEO_URL" "$CAPTION" <<'PY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url = sys.argv[2]
caption = sys.argv[3]
text = html_path.read_text(encoding="utf-8")

marker_start = "<!-- FORGE_MODULE0_VIDEO2_START -->"
marker_end = "<!-- FORGE_MODULE0_VIDEO2_END -->"

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

if marker_start in text and marker_end in text:
    text = re.sub(
        re.escape(marker_start) + r".*?" + re.escape(marker_end),
        block,
        text,
        count=1,
        flags=re.S,
    )
    action = "remplacé marqueurs VIDEO2"
else:
    # purge iframe youtube si présent
    text = re.sub(
        r'<section[^>]*id="module0-video-2"[^>]*>.*?</section>',
        "",
        text,
        flags=re.I | re.S,
    )
    text = re.sub(
        r'<iframe[^>]+youtube\.com/embed/9-n-CyHiEIo[^>]*>.*?</iframe>',
        "",
        text,
        flags=re.I | re.S,
    )
    m1 = re.search(r"<!--\s*FORGE_MODULE0_VIDEO_END\s*-->", text, flags=re.I)
    if m1:
        text = text[: m1.end()] + "\n\n" + block + "\n" + text[m1.end() :]
        action = "inséré après vidéo 1"
    else:
        mvid = re.search(
            r'(<figure[^>]*id="module0-video"[^>]*>.*?</figure>)',
            text,
            flags=re.I | re.S,
        )
        if not mvid:
            print("ERREUR insertion", file=sys.stderr)
            sys.exit(2)
        text = text[: mvid.end()] + "\n\n" + block + "\n" + text[mvid.end() :]
        action = "inséré après #module0-video"

if "forge-lesson-video.css" not in text and "</head>" in text:
    text = text.replace(
        "</head>",
        '  <link rel="stylesheet" href="/css/forge-lesson-video.css" />\n</head>',
        1,
    )

html_path.write_text(text, encoding="utf-8")
print("Action :", action)
PY

# sync public html
if [[ "$HTML" == "$APP_DIR/private/course/intro-metier.html" ]]; then
  cp -a "$HTML" "$APP_DIR/public/course/intro-metier.html"
  echo "Sync public HTML"
fi

rm -rf "$WORK"

echo ""
echo "Vérif :"
grep -n "module-0-metier.mp4\|FORGE_MODULE0_VIDEO2\|controlslist\|youtube.com/embed/9-n-CyHiEIo" "$HTML" | head -20
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"

# Échec dur si YouTube est encore là
if grep -q "youtube.com/embed/9-n-CyHiEIo" "$HTML"; then
  echo ""
  echo "ERREUR : l'iframe YouTube est ENCORE dans $HTML"
  echo "Le remplacement a échoué — envoie le grep ci-dessus."
  exit 3
fi
if ! grep -q "module-0-metier.mp4" "$HTML"; then
  echo ""
  echo "ERREUR : module-0-metier.mp4 absent du HTML"
  exit 3
fi
if [[ ! -f "$PUBLIC_VID" ]] || [[ $(stat -c%s "$PUBLIC_VID") -lt 500000 ]]; then
  echo "ERREUR : MP4 final trop petit ou manquant : $PUBLIC_VID"
  exit 3
fi

echo ""
echo "OK — plus de YouTube. Player protégé branché."
echo "→ Hard refresh : https://app.torinvest-trading.com/course/intro-metier.html"
echo "======== DONE ========"
