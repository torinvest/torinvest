#!/usr/bin/env bash
# URGENT — coupe la fuite Premium /media/*.mp4 (public 200 sans session).
# Attendu après fix : /media/... → 404 ; /course/videos/... → 302 login (anon).
#
# ssh ubuntu@164.132.46.191 'curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/audit-complet-site-691a/deploy/vps/FIX-MEDIA-PUBLIC.sh | bash'
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"

echo "======== FIX MEDIA PUBLIC (fuite Premium) ========"
echo "APP=$APP_DIR HOST=$(hostname)"

if [[ -d /mnt/c/Windows ]] || [[ "$(hostname)" == DESKTOP* ]]; then
  echo "ERREUR: lance sur le VPS, pas Windows/WSL."
  exit 1
fi

SERVER="$APP_DIR/server.js"
[[ -f "$SERVER" ]] || { echo "ERREUR: $SERVER introuvable"; exit 1; }

cp -a "$SERVER" "$SERVER.bak.media.$(date +%s)"

python3 - "$SERVER" <<'PY'
import re, sys
from pathlib import Path
server = Path(sys.argv[1])
text = server.read_text(encoding="utf-8")
orig = text

patterns = [
    (
        r"app\.use\s*\(\s*['\"]/media['\"]\s*,\s*express\.static\([^)]+\)\s*\)\s*;?",
        "/* REMOVED public /media static — TORINVEST_MEDIA_FIX */",
    ),
    (
        r"app\.get\s*\(\s*['\"]/media/:file['\"]\s*,[\s\S]*?\n\s*\)\s*;",
        "/* REMOVED GET /media/:file — TORINVEST_MEDIA_FIX */",
    ),
    (
        r"app\.get\s*\(\s*['\"]/media/\*['\"]\s*,[\s\S]*?\n\s*\)\s*;",
        "/* REMOVED GET /media/* — TORINVEST_MEDIA_FIX */",
    ),
]
for pat, rep in patterns:
    text = re.sub(pat, rep, text)

MARK_B = "/* TORINVEST_MEDIA_DENY_BEGIN */"
MARK_E = "/* TORINVEST_MEDIA_DENY_END */"
block = "\n".join(
    [
        MARK_B,
        "app.use(function torinvestDenyPublicMedia(req, res, next) {",
        "  var p = String(req.path || '').split('?')[0];",
        "  if (p === '/media' || p.indexOf('/media/') === 0) {",
        "    return res.status(404).type('text').send('Not found');",
        "  }",
        "  return next();",
        "});",
        MARK_E,
        "",
    ]
)
text = re.sub(re.escape(MARK_B) + r"[\s\S]*?" + re.escape(MARK_E) + r"\s*", "", text)
m = re.search(r"(?:const|let|var)\s+app\s*=\s*express\s*\(\s*\)\s*;?", text)
if not m:
    print("ERREUR: app=express() introuvable", file=sys.stderr)
    sys.exit(1)
text = text[: m.end()] + "\n" + block + text[m.end() :]
server.write_text(text, encoding="utf-8")
print("OK media deny injecté")
PY

if [[ -d "$APP_DIR/public/media" ]]; then
  DEST="$APP_DIR/private-media-quarantine-$(date +%s)"
  echo "==> Quarantaine public/media → $DEST"
  mv "$APP_DIR/public/media" "$DEST"
fi

node --check "$SERVER"
pm2 restart la-forge --update-env
sleep 3

MEDIA_CODE="$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3001/media/module-0-socle.mp4' || true)"
COURSE_CODE="$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3001/course/videos/module-0-socle.mp4' || true)"
echo "media=$MEDIA_CODE (attendu 404) course_videos=$COURSE_CODE (attendu 302/401)"
[[ "$MEDIA_CODE" == "404" ]] || { echo "ERREUR: /media encore accessible ($MEDIA_CODE)"; exit 1; }

echo "================ SUCCESS ================"
echo "Fuite /media coupée. Vérif live :"
echo "  curl -sI https://app.torinvest-trading.com/media/module-0-socle.mp4 | head -3"
echo "========================================="
