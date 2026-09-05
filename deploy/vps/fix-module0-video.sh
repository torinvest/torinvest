#!/usr/bin/env bash
# Diagnostic + réparation lecteur Module 0 (écran noir).
# Usage (VPS) : bash /tmp/fix-module0-video.sh
set -euo pipefail

APP="${1:-$HOME/torinvest-formation}"
PUB="$APP/public/course/videos/module-0-socle.mp4"
PRIV_DIR="$APP/private/course/videos"
PRIV="$PRIV_DIR/module-0-socle.mp4"
HTML="$APP/private/course/intro-metier.html"

echo "== Fichiers =="
ls -lh "$PUB" 2>/dev/null || echo "MANQUANT public: $PUB"
mkdir -p "$PRIV_DIR"
if [[ -f "$PUB" ]]; then
  cp -a "$PUB" "$PRIV"
  chmod 644 "$PRIV" "$PUB" || true
fi
ls -lh "$PRIV" 2>/dev/null || echo "MANQUANT private: $PRIV"

echo
echo "== Bloc HTML vidéo (extrait) =="
if [[ -f "$HTML" ]]; then
  # Affiche le bloc marqué ou les <video> proches
  if grep -q 'FORGE_MODULE0_VIDEO_START' "$HTML"; then
    awk '/FORGE_MODULE0_VIDEO_START/,/FORGE_MODULE0_VIDEO_END/' "$HTML"
  else
    grep -n -i -A5 -B2 'video\|module-0-socle' "$HTML" | head -60
  fi
else
  echo "HTML manquant: $HTML"
  exit 1
fi

echo
echo "== Réécriture propre du lecteur =="
python3 - "$HTML" <<'PY'
import re, sys
from pathlib import Path
p = Path(sys.argv[1])
t = p.read_text(encoding="utf-8")
block = """<!-- FORGE_MODULE0_VIDEO_START -->
<figure class="forge-lesson-video" id="module0-video">
  <video
    controls
    playsinline
    preload="metadata"
    controlslist="nodownload"
    style="width:100%;max-width:960px;border-radius:12px;background:#000;display:block;margin:1.25rem auto;"
  >
    <source src="/course/videos/module-0-socle.mp4" type="video/mp4" />
  </video>
  <figcaption style="text-align:center;color:#9aa3b2;font-size:0.9rem;margin-top:0.5rem;">
    TORINVEST · La Forge — Le socle avant la technique
  </figcaption>
</figure>
<!-- FORGE_MODULE0_VIDEO_END -->"""
if "FORGE_MODULE0_VIDEO_START" in t and "FORGE_MODULE0_VIDEO_END" in t:
    t2 = re.sub(
        r"<!-- FORGE_MODULE0_VIDEO_START -->.*?<!-- FORGE_MODULE0_VIDEO_END -->",
        block,
        t,
        count=1,
        flags=re.S,
    )
else:
    # remplace premier <video>...</video> ou insère après h1
    if re.search(r"<video\b[^>]*>.*?</video>", t, flags=re.I|re.S):
        t2 = re.sub(r"<video\b[^>]*>.*?</video>", block, t, count=1, flags=re.I|re.S)
    else:
        m = re.search(r"(<h1\b[^>]*>.*?</h1>)", t, flags=re.I|re.S)
        if not m:
            raise SystemExit("pas de point d'insertion")
        t2 = t[:m.end()] + "\n\n" + block + "\n" + t[m.end():]
p.write_text(t2, encoding="utf-8")
# sync public html si présent
pub = Path("/home/ubuntu/torinvest-formation/public/course/intro-metier.html")
if pub.parent.exists():
    pub.write_text(t2, encoding="utf-8")
print("HTML lecteur réécrit OK")
PY

echo
echo "== Patch CSP media-src (si besoin) =="
node - <<'NODE' || true
const fs = require("fs");
const path = "/home/ubuntu/torinvest-formation/server.js";
if (!fs.existsSync(path)) {
  console.log("server.js introuvable — skip CSP");
  process.exit(0);
}
let s = fs.readFileSync(path, "utf8");
if (s.includes("media-src") && s.includes("'self'")) {
  console.log("CSP media-src déjà présent");
  process.exit(0);
}
const marker = "/* torinvest-media-src-v1 */";
if (s.includes(marker)) {
  console.log("patch media-src déjà présent");
  process.exit(0);
}
// Inject after contentSecurityPolicy directives object if possible
const inject = `
${marker}
try {
  const helmet = require("helmet");
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "blob:"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "media-src": ["'self'", "blob:"],
        "connect-src": ["'self'", "https:", "https://radar.torinvest-trading.com", "https://www.torinvest-trading.com", "https://*.basemaps.cartocdn.com"],
        "worker-src": ["'self'", "blob:"],
        "child-src": ["'self'", "blob:"],
        "frame-src": ["'self'", "https://www.tradingview.com", "https://radar.torinvest-trading.com"],
        "font-src": ["'self'", "https:", "data:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'", "https://radar.torinvest-trading.com"],
        "frame-ancestors": ["'self'"],
        "script-src-attr": ["'none'"],
        "upgrade-insecure-requests": [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  console.log("[torinvest] CSP media-src self+blob");
} catch (e) { console.warn(e.message); }
`;
// Prefer appending near existing torinvest csp patch end, else before listen
if (s.includes("/* torinvest-csp-v2-atlas-maplibre */") || s.includes("/* torinvest-journal-csp */")) {
  // insert after last torinvest csp catch block — simpler: append before app.listen
  s = s.replace(/app\.listen\s*\(/, inject + "\napp.listen(");
} else {
  s = s.replace(/app\.listen\s*\(/, inject + "\napp.listen(");
}
fs.writeFileSync(path, s);
console.log("CSP media-src injecté — redémarre pm2");
NODE

echo
echo "== Restart la-forge =="
pm2 restart la-forge --update-env || pm2 restart all

echo
echo "== Test local fichier =="
# Test via localhost if app listens 3001/3000
for port in 3001 3000 8080; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port}/course/videos/module-0-socle.mp4" || true)
  echo "localhost:$port -> HTTP $code (302=pas de session, 200=OK, 404=mauvais root)"
done

echo
echo "Ensuite : ouvre intro-metier.html connecté → Ctrl+Shift+R"
echo "Si noir : F12 → Network → clique le mp4 → note le status (200/302/404/CSP)"
