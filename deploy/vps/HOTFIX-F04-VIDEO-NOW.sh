#!/usr/bin/env bash
# HOTFIX F4 — place la vidéo JUSTE AU-DESSUS de REPLAY ÉLITE (même pattern F2).
#
# Prérequis : MP4 déjà en place :
#   $APP_DIR/public/course/videos/f04-actifs-marches.mp4
#   $APP_DIR/private/course/videos/f04-actifs-marches.mp4
#
#   REF=cursor/module-f04-video-691a bash /tmp/hf04.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
VIDEO_NAME="${VIDEO_NAME:-f04-actifs-marches.mp4}"
VIDEO_URL="/course/videos/$VIDEO_NAME"
CAPTION="${CAPTION:-TORINVEST La Forge - F4 Classes d actifs et correlations}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"

echo "======== HOTFIX F04 VIDEO ========"
echo "APP=$APP_DIR"

if [[ ! -f "$PUBLIC_VID" ]]; then
  echo "ERREUR : $PUBLIC_VID introuvable — lance d'abord DEPLOY-F03-VIDEO-FROM-FILE.sh"
  exit 1
fi
if [[ ! -f "$PRIVATE_VID" ]]; then
  mkdir -p "$(dirname "$PRIVATE_VID")"
  cp -a "$PUBLIC_VID" "$PRIVATE_VID"
fi

HTML=""
for candidate in \
  "$APP_DIR/private/course/f04-actifs-marches.html" \
  "$APP_DIR/public/course/f04-actifs-marches.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -z "$HTML" ]] && HTML=$(find "$APP_DIR" -type f -iname 'f04-actifs-marches.html' 2>/dev/null | head -1 || true)
if [[ -z "$HTML" || ! -f "$HTML" ]]; then
  echo "ERREUR: f04-actifs-marches.html introuvable"
  exit 1
fi

F01_HTML=""
for candidate in \
  "$APP_DIR/private/course/f01-marches.html" \
  "$APP_DIR/public/course/f01-marches.html"
do
  [[ -f "$candidate" ]] && F01_HTML="$candidate" && break
done

mkdir -p "$APP_DIR/public/css"
if [[ ! -f "$APP_DIR/public/css/forge-lesson-video.css" ]]; then
  curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/la-forge/css/forge-lesson-video.css" \
    -o "$APP_DIR/public/css/forge-lesson-video.css" || true
fi

echo "HTML : $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-f04vid-$STAMP"
echo "Backup : $HTML.bak-f04vid-$STAMP"

echo ""
echo "=== DIAG avant ==="
grep -nEi 'elite-replay|chart-replay|REPLAY|ÉLITE|ELITE|f04-video|f04-actifs-marches\.mp4|FORGE_F04|<h[1-3][^>]*>' "$HTML" | head -80 || true
echo "=== fin diag ==="
echo ""

python3 - "$HTML" "${F01_HTML:-/dev/null}" "$VIDEO_URL" "$CAPTION" <<'PY'
import re
import sys
import unicodedata
from pathlib import Path

html_path = Path(sys.argv[1])
f01_path = Path(sys.argv[2])
video_url = sys.argv[3]
caption = sys.argv[4]

text = html_path.read_text(encoding="utf-8", errors="replace")
f01 = f01_path.read_text(encoding="utf-8", errors="replace") if f01_path.is_file() else ""

def fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.upper()

ms, me = "<!-- FORGE_F04_VIDEO_START -->", "<!-- FORGE_F04_VIDEO_END -->"

inner = f"""{ms}
<figure class="forge-lesson-video forge-lesson-video--protected" id="f04-video">
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

wrap_open = '<div class="media-box dashed" data-video-id="f04-actifs-marches">'
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
        'data-video-id="f04-actifs-marches"',
        attrs,
        count=1,
        flags=re.I,
    )
    attrs = re.sub(r'\sId=["\'][^"\']*["\']', "", attrs, flags=re.I)
    wrap_open = f"<{tag}{attrs}>"
    wrap_close = f"</{tag}>"
    print("F1 wrapper:", wrap_open[:160])

section = (
    "\n"
    '<section class="forge-lesson-video-section" id="f04-video-section">\n'
    '<h2 class="forge-lesson-video-heading">Video — Classes d actifs et correlations</h2>\n'
    '<p class="forge-lesson-video-lead">FX · indices · or · taux — matrice intermarket.</p>\n'
    f"{wrap_open}\n{inner}\n{wrap_close}\n"
    "</section>\n"
)

# Préserver le replay coaching F3 (2ᵉ vidéo) si déjà injecté
cms, cme = "<!-- FORGE_F04_COACHING_START -->", "<!-- FORGE_F04_COACHING_END -->"
coach_saved = None
mcoach = re.search(re.escape(cms) + r".*?" + re.escape(cme), text, flags=re.S)
if mcoach:
    coach_saved = mcoach.group(0)
    text = text[: mcoach.start()] + text[mcoach.end() :]
else:
    mcoach2 = re.search(
        r'<(?:section|div)[^>]*(?:id=["\']f04-coaching["\']|data-video-id=["\']f04-coaching["\'])[^>]*>.*?</(?:section|div)\s*>',
        text,
        flags=re.I | re.S,
    )
    if mcoach2:
        coach_saved = mcoach2.group(0)
        text = text[: mcoach2.start()] + text[mcoach2.end() :]

# Purge anciens players F3 (vidéo principale uniquement — pas f04-coaching)
text = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", text, flags=re.S)
text = re.sub(
    r'<figure[^>]*id=["\']f04-video["\'][^>]*>.*?</figure>',
    "",
    text,
    flags=re.I | re.S,
)
text = re.sub(
    r'<section[^>]*(?:id=["\']f04-video-section["\']|data-video-id=["\']f04-actifs-marches["\']|class=["\'][^"\']*forge-lesson-video-section[^"\']*["\'])[^>]*>[\s\S]*?</section\s*>',
    "",
    text,
    flags=re.I,
)
text = re.sub(
    r'<(div|aside|article)(\s[^>]*(?:data-video-id=["\']f04-actifs-marches["\']|id=["\']f04-video["\'])[^>]*)>[\s\S]*?</\1\s*>',
    "",
    text,
    flags=re.I,
)
text = re.sub(
    r'<h2[^>]*>\s*(?:Video|Vidéo)\s*[—\-]\s*(?:Classes|Actifs|Corr|Intermarket)[^<]*</h2>\s*',
    "",
    text,
    flags=re.I,
)
text = re.sub(r"\n{3,}", "\n\n", text)

insert_at = None
how = None

def find_container_before(pos, max_back=800):
    window_start = max(0, pos - max_back)
    chunk = text[window_start:pos]
    opens = list(re.finditer(r"<(section|div|article)\b[^>]*>", chunk, flags=re.I))
    if not opens:
        return None
    return window_start + opens[-1].start()

m = re.search(
    r"<(section|div|article)\b[^>]*class=[\"'][^\"']*\belite-replay\b[^\"']*[\"'][^>]*>",
    text,
    flags=re.I,
)
if m:
    insert_at = m.start()
    how = "classe .elite-replay"

if insert_at is None:
    m = re.search(
        r"<(section|div|article)\b[^>]*class=[\"'][^\"']*\bchart-replay-section\b[^\"']*[\"'][^>]*>",
        text,
        flags=re.I,
    )
    if m:
        insert_at = m.start()
        how = "classe .chart-replay-section"

if insert_at is None:
    m = re.search(r"REPLAY\s*[ÉE]LITE", text, flags=re.I)
    if not m:
        folded = fold(text)
        fm = re.search(r"REPLAY\s*ELITE", folded)
        if fm:
            m = re.search(r"REPLAY\s*E\u0301?LITE", text, flags=re.I)
            if not m:
                m = re.search(r"REPLAY\s*.LITE", text, flags=re.I)
    if m:
        cont = find_container_before(m.start())
        insert_at = cont if cont is not None else m.start()
        how = "texte REPLAY ELITE"

if insert_at is None:
    m = re.search(
        r"<(section|div|article)\b[^>]*id=[\"'][^\"']*(?:elite-replay|replay-elite|chart-replay)[^\"']*[\"'][^>]*>",
        text,
        flags=re.I,
    )
    if m:
        insert_at = m.start()
        how = "id elite/replay"

if insert_at is None:
    for hm in re.finditer(r"<h[2-4]\b[^>]*>[\s\S]{0,160}?</h[2-4]>", text, flags=re.I):
        ft = fold(hm.group(0))
        if "ELITE" in ft and "REPLAY" in ft:
            cont = find_container_before(hm.start())
            insert_at = cont if cont is not None else hm.start()
            how = "titre h* REPLAY+ELITE"
            break

# Fallback : avant Exercice / Evaluation
if insert_at is None:
    for pat, label in (
        (r"<h[2-4]\b[^>]*>[\s\S]{0,80}?Exercice", "titre Exercice"),
        (r"<h[2-4]\b[^>]*>[\s\S]{0,80}?valuat", "titre Evaluation"),
        (r"<h[2-4]\b[^>]*>[\s\S]{0,80}?Cas\s", "titre Cas"),
    ):
        m = re.search(pat, text, flags=re.I)
        if m:
            cont = find_container_before(m.start())
            insert_at = cont if cont is not None else m.start()
            how = label
            break

if insert_at is None:
    print("ERREUR: point d'insertion introuvable", file=sys.stderr)
    for i, line in enumerate(text.splitlines(), 1):
        if re.search(
            r"<h[1-3]|elite|replay|chart-replay|Exercice|Objectifs|Cas |Évaluation|Evaluation",
            line,
            flags=re.I,
        ):
            print(f"  L{i}: {line.strip()[:180]}", file=sys.stderr)
    sys.exit(2)

text = text[:insert_at] + section + text[insert_at:]
print(f"Action : insert ({how}) @ char {insert_at}")

# Remettre le coaching sous la vidéo principale
if coach_saved and "FORGE_F04_COACHING_START" not in text and 'id="f04-coaching"' not in text:
    msec = re.search(
        r'(<section[^>]*id=["\']f04-video-section["\'][^>]*>[\s\S]*?</section\s*>)',
        text,
        flags=re.I,
    )
    if msec:
        text = text[: msec.end()] + "\n\n" + coach_saved + "\n" + text[msec.end() :]
        print("Coaching F4 préservé sous #f04-video-section")
    else:
        # section déjà à insert_at — placer le coaching juste après
        end = insert_at + len(section)
        text = text[:end] + "\n" + coach_saved + "\n" + text[end:]
        print("Coaching F4 préservé (fallback après section vidéo)")

# CSS link
if "forge-lesson-video.css" not in text:
    if re.search(r"</head>", text, flags=re.I):
        text = re.sub(
            r"</head>",
            '  <link rel="stylesheet" href="/css/forge-lesson-video.css" />\n</head>',
            text,
            count=1,
            flags=re.I,
        )
        print("CSS forge-lesson-video.css injecté")

html_path.write_text(text, encoding="utf-8")
print("OK écrit:", html_path)

# Sync private ↔ public shell si les deux existent
pub = Path(str(html_path).replace("/private/course/", "/public/course/"))
priv = Path(str(html_path).replace("/public/course/", "/private/course/"))
if html_path.resolve() != pub.resolve() and pub.parent.is_dir():
    pub.write_text(text, encoding="utf-8")
    print("Sync →", pub)
if html_path.resolve() != priv.resolve() and priv.parent.is_dir():
    priv.write_text(text, encoding="utf-8")
    print("Sync →", priv)

if text.count('id="f04-video"') != 1:
    print("WARN: nb #f04-video =", text.count('id="f04-video"'), file=sys.stderr)
if "f04-actifs-marches.mp4" not in text and video_url.split("/")[-1] not in text:
    print("ERREUR: URL vidéo absente du HTML", file=sys.stderr)
    sys.exit(3)
print("OK — F4 video wired")
PY

PUBLIC_HTML="$APP_DIR/public/course/f04-actifs-marches.html"
PRIVATE_HTML="$APP_DIR/private/course/f04-actifs-marches.html"
[[ -f "$PRIVATE_HTML" ]] && HTML="$PRIVATE_HTML"
[[ -f "$PUBLIC_HTML" ]] || true

echo ""
echo "Vérif :"
grep -nEi 'f04-actifs-marches\.mp4|FORGE_F04|f04-video-section|elite-replay|REPLAY' "$HTML" | head -40 || true
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"

if ! grep -q "f04-actifs-marches.mp4\|$VIDEO_NAME" "$HTML"; then
  echo "ERREUR : vidéo absente du HTML"
  exit 3
fi

echo ""
echo "OK — player F4 protégé branché."
echo "→ Hard refresh : https://app.torinvest-trading.com/course/f04-actifs-marches.html"
echo "======== DONE ========"
