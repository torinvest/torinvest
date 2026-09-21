#!/usr/bin/env bash
# Ajoute la 2ᵉ vidéo Module 0 (YouTube) dans intro-metier.html sur le VPS.
#
# Vidéo : https://www.youtube.com/watch?v=9-n-CyHiEIo
#         « Module 0 - Métier du trader » — TORINVEST TRADING
#
# Sur le VPS :
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/wire-module0-youtube-2.sh | bash
# Avant merge :
#   REF=cursor/module0-yt2-691a curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/wire-module0-youtube-2.sh" | bash
set -euo pipefail

APP_DIR="${APP_DIR:-${1:-$HOME/torinvest-formation}}"
PUBLIC_COURSE="$APP_DIR/public/course"
PRIVATE_COURSE="$APP_DIR/private/course"
YT_ID="${YT_ID:-9-n-CyHiEIo}"
YT_TITLE="${YT_TITLE:-Module 0 — Métier du trader}"

echo "======== WIRE MODULE 0 — VIDEO 2 YouTube ========"
echo "APP=$APP_DIR"
echo "YouTube=$YT_ID"

HTML=""
for candidate in \
  "$PRIVATE_COURSE/intro-metier.html" \
  "$PUBLIC_COURSE/intro-metier.html"
do
  if [[ -f "$candidate" ]]; then
    HTML="$candidate"
    break
  fi
done

if [[ -z "$HTML" ]]; then
  FOUND=$(find "$APP_DIR" -type f -iname 'intro-metier.html' 2>/dev/null | head -5 || true)
  if [[ -n "$FOUND" ]]; then
    HTML=$(echo "$FOUND" | head -1)
  fi
fi

if [[ -z "$HTML" || ! -f "$HTML" ]]; then
  echo "ERREUR : intro-metier.html introuvable."
  ls -la "$PRIVATE_COURSE" 2>/dev/null | head -20 || true
  exit 1
fi

echo "Cible HTML : $HTML"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -a "$HTML" "$HTML.bak-yt2-$STAMP"
echo "Backup : $HTML.bak-yt2-$STAMP"

python3 - "$HTML" "$YT_ID" "$YT_TITLE" <<'PY'
import re, sys
from pathlib import Path

html_path = Path(sys.argv[1])
yt_id = sys.argv[2]
yt_title = sys.argv[3]
text = html_path.read_text(encoding="utf-8")

marker_start = "<!-- FORGE_MODULE0_VIDEO2_START -->"
marker_end = "<!-- FORGE_MODULE0_VIDEO2_END -->"

block = f"""<!-- FORGE_MODULE0_VIDEO2_START -->
<section class="forge-lesson-video forge-lesson-video--yt" id="module0-video-2" aria-label="Vidéo 2 Module 0">
  <h2 style="color:var(--gold,#ffd700);font-size:1.05rem;margin:1.5rem 0 0.65rem;text-align:center;">
    Vidéo 2 — {yt_title}
  </h2>
  <div class="forge-yt-wrap" style="position:relative;width:100%;max-width:960px;margin:0 auto 0.5rem;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;">
    <iframe
      src="https://www.youtube.com/embed/{yt_id}?rel=0"
      title="{yt_title}"
      style="position:absolute;inset:0;width:100%;height:100%;border:0;"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen
      loading="lazy"
    ></iframe>
  </div>
  <p style="text-align:center;color:#9aa3b2;font-size:0.88rem;margin:0.35rem 0 1.25rem;">
    TORINVEST · La Forge — Métier du trader
    · <a href="https://www.youtube.com/watch?v={yt_id}" target="_blank" rel="noopener noreferrer" style="color:#ffd700;">Ouvrir sur YouTube ↗</a>
  </p>
</section>
<!-- FORGE_MODULE0_VIDEO2_END -->"""

if marker_start in text and marker_end in text:
    text = re.sub(
        re.escape(marker_start) + r".*?" + re.escape(marker_end),
        block,
        text,
        count=1,
        flags=re.S,
    )
    action = "remplacé (marqueurs VIDEO2 existants)"
else:
    m1 = re.search(r"<!--\s*FORGE_MODULE0_VIDEO_END\s*-->", text, flags=re.I)
    if m1:
        idx = m1.end()
        text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
        action = "inséré après FORGE_MODULE0_VIDEO_END (vidéo 1)"
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
            mvid2 = re.search(
                r'(<figure[^>]*class="[^"]*forge-lesson-video[^"]*"[^>]*>.*?</figure>)',
                text,
                flags=re.I | re.S,
            )
            if mvid2:
                idx = mvid2.end()
                text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
                action = "inséré après premier forge-lesson-video"
            else:
                mh = re.search(r"(<h1\b[^>]*>.*?</h1>)", text, flags=re.I | re.S)
                if not mh:
                    print("ERREUR : point d'insertion introuvable", file=sys.stderr)
                    sys.exit(2)
                idx = mh.end()
                text = text[:idx] + "\n\n" + block + "\n" + text[idx:]
                action = "inséré après le premier <h1>"

html_path.write_text(text, encoding="utf-8")
print("Action :", action)
PY

if [[ "$HTML" == "$PRIVATE_COURSE/intro-metier.html" ]]; then
  mkdir -p "$PUBLIC_COURSE"
  if [[ -f "$PUBLIC_COURSE/intro-metier.html" ]]; then
    cp -a "$PUBLIC_COURSE/intro-metier.html" "$PUBLIC_COURSE/intro-metier.html.bak-before-yt2-$STAMP"
  fi
  cp -a "$HTML" "$PUBLIC_COURSE/intro-metier.html"
  echo "Sync public : $PUBLIC_COURSE/intro-metier.html"
fi

echo ""
echo "Vérif :"
grep -n "9-n-CyHiEIo\|FORGE_MODULE0_VIDEO2\|module0-video-2" "$HTML" | head -15
echo ""
echo "→ https://app.torinvest-trading.com/course/intro-metier.html"
echo "Hard refresh (Ctrl+Shift+R)."
echo "======== DONE ========"
