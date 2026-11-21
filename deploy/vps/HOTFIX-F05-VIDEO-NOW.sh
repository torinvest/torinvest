#!/usr/bin/env bash
# HOTFIX F5 — branche la vidéo dans le placeholder du module Price Action pur.
# Cherche data-video-id f05-* / « Vidéo à venir » / titre Price Action.
#
# Prérequis : MP4 déjà en place :
#   $APP_DIR/public/course/videos/f05-price-action.mp4
#   $APP_DIR/private/course/videos/f05-price-action.mp4
#
#   REF=cursor/module-f05-video-691a bash /tmp/hf05.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
VIDEO_NAME="${VIDEO_NAME:-f05-price-action.mp4}"
VIDEO_URL="/course/videos/$VIDEO_NAME"
CAPTION="${CAPTION:-TORINVEST La Forge - F5 Price Action pur}"
SLOT_ID="${SLOT_ID:-f05-price-action}"
PUBLIC_VID="$APP_DIR/public/course/videos/$VIDEO_NAME"
PRIVATE_VID="$APP_DIR/private/course/videos/$VIDEO_NAME"

echo "======== HOTFIX F05 VIDEO SLOT ($SLOT_ID) ========"
echo "APP=$APP_DIR"

if [[ ! -f "$PUBLIC_VID" ]]; then
  echo "ERREUR : $PUBLIC_VID introuvable — lance d'abord DEPLOY-F05-VIDEO-FROM-FILE.sh"
  exit 1
fi
if [[ ! -f "$PRIVATE_VID" ]]; then
  mkdir -p "$(dirname "$PRIVATE_VID")"
  cp -a "$PUBLIC_VID" "$PRIVATE_VID"
fi

HTML=""
for candidate in \
  "$APP_DIR/private/course/f05-price-action.html" \
  "$APP_DIR/public/course/f05-price-action.html"
do
  [[ -f "$candidate" ]] && HTML="$candidate" && break
done
[[ -z "$HTML" ]] && HTML=$(find "$APP_DIR" -type f -iname 'f05-price-action.html' 2>/dev/null | head -1 || true)
if [[ -z "$HTML" || ! -f "$HTML" ]]; then
  echo "ERREUR: f05-price-action.html introuvable"
  exit 1
fi

mkdir -p "$APP_DIR/public/css"
if [[ ! -f "$APP_DIR/public/css/forge-lesson-video.css" ]]; then
  curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/la-forge/css/forge-lesson-video.css" \
    -o "$APP_DIR/public/css/forge-lesson-video.css" || true
fi

echo "HTML : $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-f05vid-$STAMP"
echo "Backup : $HTML.bak-f05vid-$STAMP"

echo ""
echo "=== DIAG avant ==="
grep -nEi 'data-video-id|Vidéo à venir|Video a venir|f05-video|f05-price|FORGE_F05|Price Action|price-action' "$HTML" | head -80 || true
echo "=== fin diag ==="
echo ""

# Auto-detect existing f05 data-video-id if present
DETECTED=$(grep -oE 'data-video-id=["'\''][^"'\'']+["'\'']' "$HTML" | head -20 || true)
echo "data-video-id trouvés :"
echo "$DETECTED" || true
if echo "$DETECTED" | grep -qi 'f05-'; then
  SLOT_ID=$(echo "$DETECTED" | grep -oiE 'f05-[a-z0-9_-]+' | head -1)
  echo "Slot détecté : $SLOT_ID"
fi

python3 - "$HTML" "$VIDEO_URL" "$CAPTION" "$SLOT_ID" <<'PY'
import re
import sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url = sys.argv[2]
caption = sys.argv[3]
slot_id = sys.argv[4]

text = html_path.read_text(encoding="utf-8", errors="replace")
ms, me = "<!-- FORGE_F05_VIDEO_START -->", "<!-- FORGE_F05_VIDEO_END -->"

inner = f"""{ms}
<figure class="forge-lesson-video forge-lesson-video--protected" id="f05-video">
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

# Préserver coaching F5 si déjà injecté
cms, cme = "<!-- FORGE_F05_COACHING_START -->", "<!-- FORGE_F05_COACHING_END -->"
coach_saved = None
mcoach = re.search(re.escape(cms) + r".*?" + re.escape(cme), text, flags=re.S)
if mcoach:
    coach_saved = mcoach.group(0)
    text = text[: mcoach.start()] + text[mcoach.end() :]
else:
    mcoach2 = re.search(
        r'<(?:section|div)[^>]*(?:id=["\']f05-coaching["\']|data-video-id=["\']f05-coaching["\'])[^>]*>.*?</(?:section|div)\s*>',
        text,
        flags=re.I | re.S,
    )
    if mcoach2:
        coach_saved = mcoach2.group(0)
        text = text[: mcoach2.start()] + text[mcoach2.end() :]

# Purge ancien player F5 principal
text = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", text, flags=re.S)
text = re.sub(
    r'<figure[^>]*id=["\']f05-video["\'][^>]*>.*?</figure>',
    "",
    text,
    flags=re.I | re.S,
)
text = re.sub(
    r'<section[^>]*(?:id=["\']f05-video-section["\']|class=["\'][^"\']*forge-lesson-video-section[^"\']*["\'])[^>]*>[\s\S]*?</section\s*>',
    "",
    text,
    flags=re.I,
)
text = re.sub(r"\n{3,}", "\n\n", text)

action = None

def find_balanced(html: str, open_re: str):
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
    while i < len(html) and depth > 0:
        mo = open_pat.search(html, i)
        mc = close_pat.search(html, i)
        if mc is None:
            return None
        if mo and mo.start() < mc.start():
            chunk = mo.group(0)
            if chunk.rstrip().endswith("/>"):
                i = mo.end()
                continue
            depth += 1
            i = mo.end()
        else:
            depth -= 1
            if depth == 0:
                return {
                    "start": start,
                    "end": mc.end(),
                    "tag": tag,
                    "attrs": attrs,
                }
            i = mc.end()
    return None

# Collect possible f05 slot ids from HTML
slot_candidates = [slot_id]
for m in re.finditer(r'data-video-id=["\']([^"\']+)["\']', text, flags=re.I):
    vid = m.group(1)
    if re.match(r"f05-", vid, flags=re.I) and "coaching" not in vid.lower():
        if vid not in slot_candidates:
            slot_candidates.insert(0, vid)

slot = None
used_slot = slot_id
for sid in slot_candidates:
    slot = find_balanced(
        text,
        rf'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\']{re.escape(sid)}["\'][^>]*)>',
    )
    if slot:
        used_slot = sid
        break

if slot:
    tag, attrs = slot["tag"], slot["attrs"]
    replacement = f"<{tag}{attrs}>\n{inner}\n</{tag}>"
    text = text[: slot["start"]] + replacement + text[slot["end"] :]
    action = f"contenu intérieur <{tag} data-video-id={used_slot}>"
else:
    # Fallback : media-box / dashed avec « Vidéo à venir » ou ID f05
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
        abs_start = mopen.start()
        chunk = text[abs_start : abs_start + bal["end"]]
        if re.search(
            r"(?:Vid[ée]o\s+[àa]\s+venir|ID\s*:\s*f05-|data-video-id=[\"']f05-)",
            chunk,
            flags=re.I,
        ):
            cand = {
                "start": abs_start,
                "end": abs_start + bal["end"],
                "tag": bal["tag"],
                "attrs": bal["attrs"],
            }
            break
    if cand:
        tag, attrs = cand["tag"], cand["attrs"]
        if "data-video-id=" not in attrs.lower():
            attrs = attrs.rstrip() + f' data-video-id="{slot_id}"'
        else:
            attrs = re.sub(
                r'data-video-id=["\'][^"\']+["\']',
                f'data-video-id="{slot_id}"',
                attrs,
                count=1,
                flags=re.I,
            )
        replacement = f"<{tag}{attrs}>\n{inner}\n</{tag}>"
        text = text[: cand["start"]] + replacement + text[cand["end"] :]
        action = f"remplacé bloc Vidéo à venir → {slot_id}"
        used_slot = slot_id
    else:
        # Fallback : sous titre Vidéo / Price Action
        mtit = re.search(
            r"(<h[2-4][^>]*>\s*Vid[ée]o\s*[—\-]?[\s\S]{0,80}?Price\s*Action[\s\S]{0,80}?</h[2-4]>)",
            text,
            flags=re.I,
        )
        if not mtit:
            mtit = re.search(
                r"(<h[1-3][^>]*>[\s\S]{0,120}?Price\s*Action[\s\S]{0,80}?</h[1-3]>)",
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
            action = "inséré sous titre Price Action"
            used_slot = slot_id
        else:
            # Dernier recours : avant REPLAY ÉLITE / Exercice
            insert_at = None
            for pat, label in (
                (r"<(?:section|div|article)[^>]*class=[\"'][^\"']*\belite-replay\b", "avant elite-replay"),
                (r"REPLAY\s*[ÉE]LITE", "avant REPLAY ELITE"),
                (r"<h[2-4][^>]*>[\s\S]{0,80}?Exercice", "avant Exercice"),
            ):
                m = re.search(pat, text, flags=re.I)
                if m:
                    insert_at = m.start()
                    action = label
                    break
            if insert_at is None:
                print("ERREUR: slot F5 introuvable", file=sys.stderr)
                for needle in (slot_id, "Vidéo à venir", "Price Action", "f05-", "FORGE_F05"):
                    print(f"  {needle!r}: {needle.lower() in text.lower()}", file=sys.stderr)
                sys.exit(2)
            section = (
                "\n"
                f'<section class="forge-lesson-video-section" id="f05-video-section">\n'
                f'<h2 class="forge-lesson-video-heading">Video — Price Action pur</h2>\n'
                f'<p class="forge-lesson-video-lead">Chandeliers · S/R · supply/demand — sans indicateur.</p>\n'
                f'<div class="media-box dashed" data-video-id="{slot_id}">\n'
                f"{inner}\n</div>\n"
                f"</section>\n"
            )
            text = text[:insert_at] + section + text[insert_at:]
            used_slot = slot_id

# Remettre coaching
if coach_saved and "FORGE_F05_COACHING_START" not in text and 'id="f05-coaching"' not in text:
    m_end = re.search(r"<!--\s*FORGE_F05_VIDEO_END\s*-->", text, flags=re.I)
    if m_end:
        after = m_end.end()
        close = re.match(r"\s*</(?:div|section|aside|figure|article)\s*>", text[after:], flags=re.I)
        if close:
            after = after + close.end()
        text = text[:after] + "\n\n" + coach_saved + "\n" + text[after:]
        print("Coaching F5 préservé sous FORGE_F05_VIDEO_END")
    else:
        text = text + "\n" + coach_saved + "\n"
        print("Coaching F5 préservé (append)")

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
print("Slot :", used_slot)
print("OK écrit:", html_path)

pub = Path(str(html_path).replace("/private/course/", "/public/course/"))
priv = Path(str(html_path).replace("/public/course/", "/private/course/"))
if html_path.resolve() != pub.resolve() and pub.parent.is_dir():
    pub.write_text(text, encoding="utf-8")
    print("Sync →", pub)
if html_path.resolve() != priv.resolve() and priv.parent.is_dir():
    priv.write_text(text, encoding="utf-8")
    print("Sync →", priv)

if text.count('id="f05-video"') != 1:
    print("WARN: nb #f05-video =", text.count('id="f05-video"'), file=sys.stderr)
if video_url.split("/")[-1] not in text and "f05-price-action.mp4" not in text:
    print("ERREUR: URL vidéo absente du HTML", file=sys.stderr)
    sys.exit(3)
print("OK — F5 video wired into", used_slot)
PY

PUBLIC_HTML="$APP_DIR/public/course/f05-price-action.html"
PRIVATE_HTML="$APP_DIR/private/course/f05-price-action.html"
[[ -f "$PRIVATE_HTML" ]] && HTML="$PRIVATE_HTML"

echo ""
echo "Vérif :"
grep -nEi 'f05-price-action\.mp4|FORGE_F05|f05-video|data-video-id|Vidéo à venir' "$HTML" | head -40 || true
ls -lh "$PUBLIC_VID" "$PRIVATE_VID"

if ! grep -q "f05-price-action.mp4\|$VIDEO_NAME" "$HTML"; then
  echo "ERREUR : vidéo absente du HTML"
  exit 3
fi

echo ""
echo "OK — player F5 Price Action branché."
echo "→ Hard refresh : https://app.torinvest-trading.com/course/f05-price-action.html"
echo "======== DONE ========"
