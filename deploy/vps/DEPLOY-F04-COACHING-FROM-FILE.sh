#!/usr/bin/env bash
# Module F4 — 2ᵉ vidéo : replay coaching (protégée, sous la vidéo principale).
# Même pattern que DEPLOY-F03-COACHING-FROM-FILE.sh.
#
# Fichier source (ton PC) :
#   C:\Users\gheza\OneDrive\Documents\Zoom\2026-11-08 19.11\video1830141920.mp4
#
# 1) Upload (PowerShell ou Ubuntu) :
#    scp "C:\Users\gheza\OneDrive\Documents\Zoom\2026-11-08 19.11\video1830141920.mp4" ubuntu@164.132.46.191:~/f04-coaching.mp4
#    # Ubuntu/WSL :
#    scp "/mnt/c/Users/gheza/OneDrive/Documents/Zoom/2026-11-08 19.11/video1830141920.mp4" ubuntu@164.132.46.191:~/f04-coaching.mp4
#
# 2) VPS :
#    export VIDEO_SRC=~/f04-coaching.mp4
#    export REF=cursor/module-f04-coaching-691a
#    curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-F04-COACHING-FROM-FILE.sh" -o /tmp/d-f04c.sh
#    bash /tmp/d-f04c.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/module-f04-coaching-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
VIDEO_NAME="${VIDEO_NAME:-f04-coaching.mp4}"
CAPTION="${CAPTION:-TORINVEST La Forge - Replay coaching F4}"
SECTION_TITLE="${SECTION_TITLE:-Replay coaching — Live}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
VIDEO_URL="/course/videos/$VIDEO_NAME"
VIDEO_SRC="${VIDEO_SRC:-}"
FORCE_COMPRESS="${FORCE_COMPRESS:-1}"

echo "======== F04 COACHING VIDEO ($REF) ========"
mkdir -p "$APP_DIR/public/course/videos" "$APP_DIR/private/course/videos" "$APP_DIR/public/css"

if [[ -z "$VIDEO_SRC" ]]; then
  shopt -s nullglob
  for c in \
    "$PUBLIC_VID" \
    "$HOME/f04-coaching.mp4" \
    "$HOME/f04-coaching.mkv" \
    "$HOME/video1830141920.mp4" \
    "$HOME"/video1830141920*.mp4 \
    "$HOME/Downloads/video1830141920.mp4" \
    "$HOME"/Downloads/video1830141920*.mp4 \
    "/tmp/f04-coaching.mp4" \
    "/tmp/video1830141920.mp4"
  do
    if [[ -f "$c" ]] && [[ $(stat -c%s "$c" 2>/dev/null || echo 0) -gt 500000 ]]; then
      VIDEO_SRC="$c"
      break
    fi
  done
  shopt -u nullglob
fi

if [[ -z "$VIDEO_SRC" || ! -f "$VIDEO_SRC" ]]; then
  echo "ERREUR : recording coaching F4 introuvable."
  echo "  scp \"C:\\Users\\gheza\\OneDrive\\Documents\\Zoom\\2026-11-08 19.11\\video1830141920.mp4\" ubuntu@164.132.46.191:~/f04-coaching.mp4"
  echo "  export VIDEO_SRC=~/f04-coaching.mp4 REF=$REF"
  echo "  bash /tmp/d-f04c.sh"
  exit 1
fi

echo "Source : $VIDEO_SRC ($(ls -lh "$VIDEO_SRC" | awk '{print $5}'))"
WORK="/tmp/forge-f04-coach-$$"
mkdir -p "$WORK"

vcodec=""; acodec=""
if command -v ffprobe >/dev/null 2>&1; then
  vcodec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  acodec=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO_SRC" 2>/dev/null || true)
  echo "Codecs : vidéo=$vcodec audio=$acodec"
fi

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
  "$APP_DIR/private/course/f04-actifs-marches.html" \
  "$APP_DIR/public/course/f04-actifs-marches.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -z "$HTML" ]] && HTML=$(find "$APP_DIR" -type f -iname 'f04-actifs-marches.html' 2>/dev/null | head -1 || true)
[[ -n "$HTML" && -f "$HTML" ]] || { echo "ERREUR: f04-actifs-marches.html introuvable"; exit 1; }

echo "HTML : $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-f04coach-$STAMP"

python3 - "$HTML" "$VIDEO_URL" "$CAPTION" "$SECTION_TITLE" <<'PY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url = sys.argv[2]
caption = sys.argv[3]
section_title = sys.argv[4]
text = html_path.read_text(encoding="utf-8", errors="replace")

ms, me = "<!-- FORGE_F04_COACHING_START -->", "<!-- FORGE_F04_COACHING_END -->"

block = f"""{ms}
<section class="forge-lesson-video-slot" data-video-id="f04-coaching" id="f04-coaching">
  <h2 class="forge-lesson-video-heading">{section_title}</h2>
  <p class="forge-lesson-video-lead">Replay du live coaching — session Premium.</p>
  <figure class="forge-lesson-video forge-lesson-video--protected" id="f04-video-coaching">
    <video controls playsinline preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false">
      <source src="{video_url}" type="video/mp4" />
      Votre navigateur ne lit pas la video HTML5.
    </video>
    <figcaption>{caption}</figcaption>
  </figure>
</section>
{me}"""

# Retirer ancien bloc coaching (ne pas toucher la vidéo principale F4)
text = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", text, flags=re.S)
text = re.sub(
    r'<(?:section|div)[^>]*(?:id=["\']f04-coaching["\']|data-video-id=["\']f04-coaching["\'])[^>]*>.*?</(?:section|div)\s*>',
    "",
    text,
    flags=re.I | re.S,
)
text = re.sub(
    r'<figure[^>]*id=["\']f04-video-coaching["\'][^>]*>.*?</figure>',
    "",
    text,
    flags=re.I | re.S,
)

action = None

# 1) Placeholder dédié coaching
m = re.search(
    r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\']f04-coaching["\'][^>]*)>(.*?)</\1\s*>',
    text,
    flags=re.I | re.S,
)
if m:
    tag, attrs = m.group(1), m.group(2)
    inner = f"""{ms}
  <h2 class="forge-lesson-video-heading">{section_title}</h2>
  <p class="forge-lesson-video-lead">Replay du live coaching — session Premium.</p>
  <figure class="forge-lesson-video forge-lesson-video--protected" id="f04-video-coaching">
    <video controls playsinline preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false">
      <source src="{video_url}" type="video/mp4" />
      Votre navigateur ne lit pas la video HTML5.
    </video>
    <figcaption>{caption}</figcaption>
  </figure>
{me}"""
    text = text[: m.start()] + f"<{tag}{attrs}>\n{inner}\n</{tag}>" + text[m.end() :]
    action = "remplacé data-video-id=f04-coaching"
else:
    # 2) Juste sous la vidéo principale F4 (slot correlations / markers)
    m1 = re.search(r"<!--\s*FORGE_F04_VIDEO_END\s*-->", text, flags=re.I)
    if m1:
        # si le marker est dans un wrapper media-box, sortir après le wrapper fermant
        after = m1.end()
        close = re.match(r"\s*</(?:div|section|aside|figure|article)\s*>", text[after:], flags=re.I)
        if close:
            after = after + close.end()
        text = text[:after] + "\n\n" + block + "\n" + text[after:]
        action = "inséré après FORGE_F04_VIDEO_END"
    else:
        mfig = re.search(
            r'(<figure[^>]*id=["\']f04-video["\'][^>]*>.*?</figure>)',
            text,
            flags=re.I | re.S,
        )
        if mfig:
            after = mfig.end()
            close = re.match(r"\s*</(?:div|section|aside|figure|article)\s*>", text[after:], flags=re.I)
            if close:
                after = after + close.end()
            text = text[:after] + "\n\n" + block + "\n" + text[after:]
            action = "inséré après #f04-video"
        else:
            # 3) Sous le titre Matrice intermarchés / slot correlations
            mslot = re.search(
                r'data-video-id=["\']f04-actifs-correlations["\']',
                text,
                flags=re.I,
            )
            if mslot:
                # remonter à l'ouverture puis fermer le wrapper balancé
                open_m = None
                for om in re.finditer(
                    r"<(div|section|aside|figure|article)\b[^>]*>",
                    text[: mslot.end()],
                    flags=re.I,
                ):
                    open_m = om
                if open_m:
                    tag = open_m.group(1)
                    i = open_m.end()
                    depth = 1
                    open_pat = re.compile(rf"<{tag}\b[^>]*>", flags=re.I)
                    close_pat = re.compile(rf"</{tag}\s*>", flags=re.I)
                    end = None
                    while i < len(text) and depth > 0:
                        mo = open_pat.search(text, i)
                        mc = close_pat.search(text, i)
                        if mc is None:
                            break
                        if mo and mo.start() < mc.start():
                            if not mo.group(0).rstrip().endswith("/>"):
                                depth += 1
                            i = mo.end()
                        else:
                            depth -= 1
                            if depth == 0:
                                end = mc.end()
                                break
                            i = mc.end()
                    if end is not None:
                        text = text[:end] + "\n\n" + block + "\n" + text[end:]
                        action = "inséré après slot f04-actifs-correlations"
            if action is None:
                # 4) Avant REPLAY ÉLITE
                mcas = re.search(
                    r'(<(?:section|div|article)[^>]*>[\s\S]{0,120}?REPLAY\s*[ÉE]LITE)',
                    text,
                    flags=re.I,
                )
                if mcas:
                    text = text[: mcas.start()] + block + "\n\n" + text[mcas.start() :]
                    action = "inséré avant REPLAY ÉLITE"
                else:
                    print("ERREUR: point d'insertion coaching F4 introuvable", file=sys.stderr)
                    for needle in (
                        "FORGE_F04_VIDEO",
                        "f04-actifs-correlations",
                        "f04-video",
                        "REPLAY",
                        "Matrice",
                    ):
                        print(f"  {needle!r}: {needle.lower() in text.lower()}", file=sys.stderr)
                    sys.exit(2)

if "forge-lesson-video.css" not in text and "</head>" in text:
    text = text.replace(
        "</head>",
        '  <link rel="stylesheet" href="/css/forge-lesson-video.css?v=f04c" />\n</head>',
        1,
    )
else:
    text = re.sub(
        r'forge-lesson-video\.css(\?v=[^"]*)?',
        "forge-lesson-video.css?v=f04c",
        text,
        count=1,
    )

text = re.sub(r"\n{4,}", "\n\n\n", text)
html_path.write_text(text, encoding="utf-8")
print("Action :", action)
if "f04-coaching.mp4" not in text and video_url.split("/")[-1] not in text:
    print("ERREUR: mp4 coaching absent du HTML", file=sys.stderr)
    sys.exit(3)

# Sync private ↔ public
pub = Path(str(html_path).replace("/private/course/", "/public/course/"))
priv = Path(str(html_path).replace("/public/course/", "/private/course/"))
if html_path.resolve() != pub.resolve() and pub.parent.is_dir():
    pub.write_text(text, encoding="utf-8")
    print("Sync →", pub)
if html_path.resolve() != priv.resolve() and priv.parent.is_dir():
    priv.write_text(text, encoding="utf-8")
    print("Sync →", priv)
PY

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

rm -rf "$WORK"

echo ""
grep -n "f04-coaching\|FORGE_F04_COACHING\|f04-video-coaching" "$HTML" | head -20
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"
echo ""
echo "OK — replay coaching F4 branché sous la vidéo principale."
echo "→ Hard refresh : https://app.torinvest-trading.com/course/f04-actifs-marches.html"
echo "======== DONE ========"
