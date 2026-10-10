#!/usr/bin/env bash
# HOTFIX F2 — place la video JUSTE AU-DESSUS de REPLAY ELITE
# (classe .elite-replay / texte REPLAY ÉLITE), comme F1 coaching.
#
# Patche PUBLIC (servi) + PRIVATE. Python 100% inline. Zero .py distant.
#
# VPS :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/module-f2-video-above-elite-691a/deploy/vps/HOTFIX-F02-VIDEO-NOW.sh" -o /tmp/hf02.sh
#   bash /tmp/hf02.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
VIDEO_NAME="${VIDEO_NAME:-f02-xauusd.mp4}"
VIDEO_URL="/course/videos/$VIDEO_NAME"
CAPTION="${CAPTION:-TORINVEST La Forge - F2 XAUUSD - anatomie de lor}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"
PUBLIC_HTML="$APP_DIR/public/course/f02-xauusd.html"
PRIVATE_HTML="$APP_DIR/private/course/f02-xauusd.html"
F01_HTML=""
for c in "$APP_DIR/public/course/f01-marches.html" "$APP_DIR/private/course/f01-marches.html"; do
  [[ -f "$c" ]] && F01_HTML="$c" && break
done

echo "======== HOTFIX F02 — AU-DESSUS DE REPLAY ELITE ========"

# ——— MP4 ———
mkdir -p "$(dirname "$PUBLIC_VID")" "$(dirname "$PRIVATE_VID")"
if [[ ! -f "$PUBLIC_VID" ]] || [[ $(stat -c%s "$PUBLIC_VID" 2>/dev/null || echo 0) -lt 500000 ]]; then
  SRC=""
  for c in "$HOME/f02-xauusd.mp4" "$PRIVATE_VID" "/tmp/f02-xauusd.mp4" "$HOME"/F2*.mp4; do
    [[ -f "$c" ]] || continue
    [[ $(stat -c%s "$c" 2>/dev/null || echo 0) -gt 500000 ]] || continue
    SRC="$c"; break
  done
  [[ -n "$SRC" ]] || { echo "ERREUR: ~/f02-xauusd.mp4 introuvable"; exit 1; }
  cp -a "$SRC" "$PUBLIC_VID"
  echo "MP4 copie depuis $SRC"
fi
chmod 644 "$PUBLIC_VID"
cp -a "$PUBLIC_VID" "$PRIVATE_VID"
chmod 644 "$PRIVATE_VID"
echo "OK MP4 : $(ls -lh "$PUBLIC_VID" | awk '{print $5}')"

# Source HTML = public d'abord (c'est ce que le serveur sert)
HTML=""
for candidate in "$PUBLIC_HTML" "$PRIVATE_HTML"; do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -z "$HTML" ]] && HTML=$(find "$APP_DIR" -type f -iname 'f02-xauusd.html' 2>/dev/null | head -1 || true)
[[ -n "$HTML" && -f "$HTML" ]] || { echo "ERREUR: f02-xauusd.html introuvable"; exit 1; }

echo "HTML source : $HTML"
echo "F01         : ${F01_HTML:-ABSENT}"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-f02elite-$STAMP"

mkdir -p "$APP_DIR/public/css"
if [[ ! -f "$APP_DIR/public/css/forge-lesson-video.css" ]]; then
  curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/la-forge/css/forge-lesson-video.css" \
    -o "$APP_DIR/public/css/forge-lesson-video.css" || true
fi

echo ""
echo "=== DIAG avant (h2/h3 + elite/replay/video) ==="
grep -nEi 'elite-replay|chart-replay|REPLAY|ÉLITE|ELITE|f02-video|f02-xauusd\.mp4|FORGE_F02|<h[1-3][^>]*>' "$HTML" | head -80 || true
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
    # ÉLITE / ELITE / ÉLITE → ELITE
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.upper()

ms, me = "<!-- FORGE_F02_VIDEO_START -->", "<!-- FORGE_F02_VIDEO_END -->"

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

section = (
    "\n"
    '<section class="forge-lesson-video-section" id="f02-video-section">\n'
    '<h2 class="forge-lesson-video-heading">Video — Anatomie de l or en conditions reelles</h2>\n'
    '<p class="forge-lesson-video-lead">Sessions, volatilite et correlations sur XAUUSD.</p>\n'
    f"{wrap_open}\n{inner}\n{wrap_close}\n"
    "</section>\n"
)

# --- 1) PURGE tout ancien player F2 ---
text = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", text, flags=re.S)
text = re.sub(
    r'<figure[^>]*id=["\']f02-video["\'][^>]*>.*?</figure>',
    "",
    text,
    flags=re.I | re.S,
)
text = re.sub(
    r'<section[^>]*(?:id=["\']f02-video[^"\']*["\']|data-video-id=["\']f02-[^"\']*["\']|class=["\'][^"\']*forge-lesson-video(?:-slot|-section)?[^"\']*["\'])[^>]*>[\s\S]*?</section\s*>',
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
text = re.sub(
    r'<h2[^>]*>\s*(?:Video|Vidéo)\s*[—\-]\s*(?:XAUUSD|Anatomie)[^<]*</h2>\s*',
    "",
    text,
    flags=re.I,
)
text = re.sub(r"\n{3,}", "\n\n", text)

# --- 2) Trouver le point d'insertion = DEBUT du bloc REPLAY ELITE ---
insert_at = None
how = None

def find_container_before(pos, max_back=800):
    window_start = max(0, pos - max_back)
    chunk = text[window_start:pos]
    opens = list(re.finditer(r"<(section|div|article)\b[^>]*>", chunk, flags=re.I))
    if not opens:
        return None
    return window_start + opens[-1].start()

# A) classe .elite-replay d'abord (le plus fiable)
m = re.search(
    r"<(section|div|article)\b[^>]*class=[\"'][^\"']*\belite-replay\b[^\"']*[\"'][^>]*>",
    text,
    flags=re.I,
)
if m:
    insert_at = m.start()
    how = "classe .elite-replay"

# B) classe .chart-replay-section
if insert_at is None:
    m = re.search(
        r"<(section|div|article)\b[^>]*class=[\"'][^\"']*\bchart-replay-section\b[^\"']*[\"'][^>]*>",
        text,
        flags=re.I,
    )
    if m:
        insert_at = m.start()
        how = "classe .chart-replay-section"

# C) texte REPLAY ÉLITE / REPLAY ELITE (accents ignores)
if insert_at is None:
    m = re.search(r"REPLAY\s*[ÉE]LITE", text, flags=re.I)
    if not m:
        # NFKD fold
        folded = fold(text)
        fm = re.search(r"REPLAY\s*ELITE", folded)
        if fm:
            # retrouver dans l'original (E + combining acute possible)
            m = re.search(r"REPLAY\s*E\u0301?LITE", text, flags=re.I)
            if not m:
                m = re.search(r"REPLAY\s*.LITE", text, flags=re.I)
    if m:
        cont = find_container_before(m.start())
        insert_at = cont if cont is not None else m.start()
        how = "texte REPLAY ELITE"

# D) id elite/replay
if insert_at is None:
    m = re.search(
        r"<(section|div|article)\b[^>]*id=[\"'][^\"']*(?:elite-replay|replay-elite|chart-replay)[^\"']*[\"'][^>]*>",
        text,
        flags=re.I,
    )
    if m:
        insert_at = m.start()
        how = "id elite/replay"

# E) titre h2/h3 avec REPLAY + ELITE
if insert_at is None:
    for hm in re.finditer(r"<h[2-4]\b[^>]*>[\s\S]{0,160}?</h[2-4]>", text, flags=re.I):
        ft = fold(hm.group(0))
        if "ELITE" in ft and "REPLAY" in ft:
            cont = find_container_before(hm.start())
            insert_at = cont if cont is not None else hm.start()
            how = "titre h* REPLAY+ELITE"
            break

if insert_at is None:
    print("ERREUR: impossible de trouver REPLAY ELITE / .elite-replay", file=sys.stderr)
    print("--- dump titres / classes utiles ---", file=sys.stderr)
    for i, line in enumerate(text.splitlines(), 1):
        if re.search(
            r"<h[1-3]|elite|replay|chart-replay|Exercice|Objectifs|Cas |Évaluation|Evaluation",
            line,
            flags=re.I,
        ):
            print(f"  L{i}: {line.strip()[:180]}", file=sys.stderr)
    dump = Path("/tmp/f02-diag-headings.txt")
    lines = []
    for i, line in enumerate(text.splitlines(), 1):
        if re.search(r"<h[1-4]|class=|id=.*replay|elite", line, flags=re.I):
            lines.append(f"L{i}: {line.rstrip()[:240]}")
    dump.write_text("\n".join(lines), encoding="utf-8")
    print(f"Dump: {dump}  →  colle ce fichier si ca rate encore", file=sys.stderr)
    sys.exit(2)

text = text[:insert_at] + section + text[insert_at:]
print(f"Action : insert avant REPLAY ELITE ({how}) @ char {insert_at}")

if "forge-lesson-video.css" not in text and "</head>" in text:
    text = text.replace(
        "</head>",
        '  <link rel="stylesheet" href="/css/forge-lesson-video.css?v=f02elite" />\n</head>',
        1,
    )
else:
    text = re.sub(
        r'forge-lesson-video\.css(\?v=[^"]*)?',
        "forge-lesson-video.css?v=f02elite",
        text,
        count=1,
    )

text = re.sub(r"\n{4,}", "\n\n\n", text)
html_path.write_text(text, encoding="utf-8")

vid = text.find("f02-xauusd.mp4")
if vid < 0:
    print("ERREUR: mp4 absent", file=sys.stderr)
    sys.exit(3)

# Verif: video AVANT le marqueur elite restant
elite_after = re.search(
    r"elite-replay|REPLAY\s*[ÉE]LITE|chart-replay-section",
    text[vid:],
    flags=re.I,
)
if not elite_after:
    print("WARN: apres video, plus de marqueur elite visible", file=sys.stderr)
else:
    print(f"OK: video @ {vid}, elite {elite_after.start()} chars plus loin")

# Mauvais seulement si aucun h2 entre h1 et la video (colle sous le titre)
h1 = re.search(r"</h1\s*>", text, flags=re.I)
if h1:
    between = text[h1.end() : vid]
    if not re.search(r"<h2\b", between, flags=re.I):
        print("ERREUR: video colle sous h1 (aucun h2 avant)", file=sys.stderr)
        sys.exit(3)

print("OK placement F2 au-dessus de REPLAY ELITE")
PY

# Sync PUBLIC + PRIVATE (le serveur sert public/)
mkdir -p "$APP_DIR/public/course" "$APP_DIR/private/course"
if [[ "$HTML" != "$PUBLIC_HTML" ]]; then
  cp -a "$HTML" "$PUBLIC_HTML"
  echo "Sync -> public/course/f02-xauusd.html"
else
  echo "HTML deja = public/course/f02-xauusd.html"
fi
if [[ "$HTML" != "$PRIVATE_HTML" ]]; then
  cp -a "$HTML" "$PRIVATE_HTML"
  echo "Sync -> private/course/f02-xauusd.html"
else
  echo "HTML deja = private/course/f02-xauusd.html"
fi

echo ""
echo "=== VERIF apres ==="
grep -nEi 'f02-xauusd\.mp4|FORGE_F02|f02-video-section|elite-replay|REPLAY|Exercice sur chart' "$PUBLIC_HTML" | head -50
echo ""

# Rapport ordre
python3 - "$PUBLIC_HTML" <<'CHK'
import re, sys
from pathlib import Path
t = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
items = []
for label, pat in [
    ("VIDEO", r'f02-xauusd\.mp4'),
    ("ELITE", r'elite-replay|REPLAY\s*[ÉE]LITE|chart-replay-section'),
    ("EXERCICE", r'<h[2-4][^>]*>\s*Exercice\s+sur\s+chart'),
    ("H1", r'<h1\b'),
]:
    m = re.search(pat, t, flags=re.I)
    if m:
        items.append((m.start(), label))
items.sort()
print("ORDRE:", " -> ".join(f"{lab}@{pos}" for pos, lab in items))
vids = [i for i in items if i[1] == "VIDEO"]
elites = [i for i in items if i[1] == "ELITE"]
if vids and elites and vids[0][0] < elites[0][0]:
    print("OK ORDRE: VIDEO avant ELITE")
else:
    print("ECHEC ORDRE: VIDEO pas avant ELITE")
    sys.exit(3)
CHK

echo ""
echo "OK — video F2 juste AU-DESSUS de REPLAY ELITE."
echo "-> Ctrl+Shift+R : https://app.torinvest-trading.com/course/f02-xauusd.html"
echo "======== DONE ========"
