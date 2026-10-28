#!/usr/bin/env bash
# HOTFIX F4 — branche la vidéo DANS le placeholder prévu :
#   data-video-id="f04-actifs-correlations"
#   (« Vidéo — Matrice intermarchés live • XAU vs DXY vs US10Y »)
# Même pattern que F1 (contenu intérieur du wrapper, grille intacte).
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
CAPTION="${CAPTION:-TORINVEST La Forge - F4 Matrice intermarches live XAU vs DXY vs US10Y}"
SLOT_ID="f04-actifs-correlations"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"

echo "======== HOTFIX F04 VIDEO SLOT ($SLOT_ID) ========"
echo "APP=$APP_DIR"

if [[ ! -f "$PUBLIC_VID" ]]; then
  echo "ERREUR : $PUBLIC_VID introuvable — lance d'abord DEPLOY-F04-VIDEO-FROM-FILE.sh"
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
grep -nEi 'f04-actifs-correlations|Vidéo à venir|Video a venir|f04-video|f04-actifs-marches\.mp4|FORGE_F04|Matrice inter' "$HTML" | head -80 || true
echo "=== fin diag ==="
echo ""

python3 - "$HTML" "$VIDEO_URL" "$CAPTION" "$SLOT_ID" <<'PY'
import re
import sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url = sys.argv[2]
caption = sys.argv[3]
slot_id = sys.argv[4]

text = html_path.read_text(encoding="utf-8", errors="replace")
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

# 1) Purge ancien player F4 mal placé (section inventée au-dessus du replay, etc.)
text = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", text, flags=re.S)
text = re.sub(
    r'<figure[^>]*id=["\']f04-video["\'][^>]*>.*?</figure>',
    "",
    text,
    flags=re.I | re.S,
)
text = re.sub(
    r'<section[^>]*(?:id=["\']f04-video-section["\']|class=["\'][^"\']*forge-lesson-video-section[^"\']*["\'])[^>]*>[\s\S]*?</section\s*>',
    "",
    text,
    flags=re.I,
)
# Titre orphelin injecté par l'ancien hotfix (pas le titre natif Matrice intermarchés)
text = re.sub(
    r'<h2[^>]*class=["\'][^"\']*forge-lesson-video-heading[^"\']*["\'][^>]*>\s*(?:Video|Vidéo)\s*[—\-]\s*Classes[^<]*</h2>\s*',
    "",
    text,
    flags=re.I,
)
text = re.sub(
    r'<p[^>]*class=["\'][^"\']*forge-lesson-video-lead[^"\']*["\'][^>]*>[\s\S]*?</p>\s*',
    "",
    text,
    flags=re.I,
)
text = re.sub(r"\n{3,}", "\n\n", text)

action = None

def find_balanced(html: str, open_re: str):
    """Trouve <tag attrs...>…</tag> avec profondeur (div imbriqués OK)."""
    m = re.search(open_re, html, flags=re.I | re.S)
    if not m:
        return None
    tag = m.group(1)
    attrs = m.group(2)
    start = m.start()
    i = m.end()
    depth = 1
    open_pat = re.compile(rf"<{tag}\b[^>]*>", flags=re.I)
    close_pat = re.compile(rf"</{tag}\s*>", flags=re.I)
    # ignore self-closing already ended by />
    while i < len(html) and depth > 0:
        mo = open_pat.search(html, i)
        mc = close_pat.search(html, i)
        if mc is None:
            return None
        if mo and mo.start() < mc.start():
            # skip void-ish self-close
            chunk = mo.group(0)
            if chunk.rstrip().endswith("/>"):
                i = mo.end()
                continue
            depth += 1
            i = mo.end()
        else:
            depth -= 1
            if depth == 0:
                end = mc.end()
                return {
                    "start": start,
                    "end": end,
                    "tag": tag,
                    "attrs": attrs,
                    "open_end": m.end(),
                    "close_start": mc.start(),
                }
            i = mc.end()
    return None

# 2) Remplacer UNIQUEMENT le contenu intérieur du wrapper data-video-id
#    (conserve classes / grille / titre « Matrice intermarchés »)
slot = find_balanced(
    text,
    rf'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\']{re.escape(slot_id)}["\'][^>]*)>',
)
if slot:
    tag, attrs = slot["tag"], slot["attrs"]
    replacement = f"<{tag}{attrs}>\n{inner}\n</{tag}>"
    text = text[: slot["start"]] + replacement + text[slot["end"] :]
    action = f"contenu intérieur <{tag} data-video-id={slot_id}>"
else:
    # Fallback : conteneur media-box / dashed contenant « Vidéo à venir » ou l'ID
    cand = None
    for mopen in re.finditer(
        r'<(div|section|aside|figure|article)(\s[^>]*(?:class=["\'][^"\']*(?:media-box|video-slot|dashed)[^"\']*["\'])[^>]*)>',
        text,
        flags=re.I,
    ):
        bal = find_balanced(
            text[mopen.start() :],
            r'<(div|section|aside|figure|article)(\s[^>]*)>',
        )
        if not bal:
            continue
        # remap to absolute offsets
        abs_start = mopen.start()
        chunk = text[abs_start : abs_start + bal["end"]]
        if re.search(rf"(?:Vid[ée]o\s+[àa]\s+venir|ID\s*:\s*{re.escape(slot_id)})", chunk, flags=re.I):
            cand = {
                "start": abs_start,
                "end": abs_start + bal["end"],
                "tag": bal["tag"],
                "attrs": bal["attrs"],
            }
            break
    if cand:
        tag, attrs = cand["tag"], cand["attrs"]
        if f'data-video-id="{slot_id}"' not in attrs and f"data-video-id='{slot_id}'" not in attrs:
            attrs = attrs.rstrip() + f' data-video-id="{slot_id}"'
        replacement = f"<{tag}{attrs}>\n{inner}\n</{tag}>"
        text = text[: cand["start"]] + replacement + text[cand["end"] :]
        action = f"remplacé bloc Vidéo à venir → {slot_id}"
    else:
        # Fallback : sous le titre Matrice intermarchés
        mtit = re.search(
            r"(<h[2-4][^>]*>\s*Vid[ée]o\s*[—\-]\s*Matrice\s+intermarch[ée]s[\s\S]{0,120}?</h[2-4]>)",
            text,
            flags=re.I,
        )
        if mtit:
            after = mtit.end()
            p = re.match(r"\s*<p\b[^>]*>.*?</p>", text[after:], flags=re.I | re.S)
            if p:
                after = after + p.end()
            wrap = (
                f'\n<div class="media-box dashed" data-video-id="{slot_id}">\n'
                f"{inner}\n</div>\n"
            )
            text = text[:after] + wrap + text[after:]
            action = "inséré sous titre Matrice intermarchés"
        else:
            print(f"ERREUR: slot {slot_id} introuvable", file=sys.stderr)
            for needle in (slot_id, "Vidéo à venir", "Matrice inter", "FORGE_F04"):
                print(f"  {needle!r}: {needle.lower() in text.lower()}", file=sys.stderr)
            sys.exit(2)

# CSS
if "forge-lesson-video.css" not in text and re.search(r"</head>", text, flags=re.I):
    text = re.sub(
        r"</head>",
        '  <link rel="stylesheet" href="/css/forge-lesson-video.css" />\n</head>',
        text,
        count=1,
        flags=re.I,
    )
    print("CSS forge-lesson-video.css injecté")

text = re.sub(r"\n{4,}", "\n\n\n", text)
html_path.write_text(text, encoding="utf-8")
print("Action :", action)
print("OK écrit:", html_path)

# Sync private ↔ public
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
if video_url.split("/")[-1] not in text and "f04-actifs-marches.mp4" not in text:
    print("ERREUR: URL vidéo absente du HTML", file=sys.stderr)
    sys.exit(3)
# Placeholder ne doit plus rester dans le slot
if re.search(
    rf'data-video-id=["\']{re.escape(slot_id)}["\'][^>]*>[\s\S]{{0,400}}?Vid[ée]o\s+[àa]\s+venir',
    text,
    flags=re.I,
):
    print("WARN: « Vidéo à venir » encore dans le slot", file=sys.stderr)
print("OK — F4 video wired into", slot_id)
PY

PUBLIC_HTML="$APP_DIR/public/course/f04-actifs-marches.html"
PRIVATE_HTML="$APP_DIR/private/course/f04-actifs-marches.html"
[[ -f "$PRIVATE_HTML" ]] && HTML="$PRIVATE_HTML"

echo ""
echo "Vérif :"
grep -nEi 'f04-actifs-correlations|f04-actifs-marches\.mp4|FORGE_F04|f04-video|Vidéo à venir' "$HTML" | head -40 || true
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"

if ! grep -q "f04-actifs-marches.mp4\|$VIDEO_NAME" "$HTML"; then
  echo "ERREUR : vidéo absente du HTML"
  exit 3
fi
if ! grep -q 'data-video-id="f04-actifs-correlations"\|data-video-id='\''f04-actifs-correlations'\''' "$HTML"; then
  echo "WARN : data-video-id=f04-actifs-correlations absent (fallback titre ?)"
fi

echo ""
echo "OK — player F4 dans le slot f04-actifs-correlations."
echo "→ Hard refresh : https://app.torinvest-trading.com/course/f04-actifs-marches.html"
echo "======== DONE ========"
