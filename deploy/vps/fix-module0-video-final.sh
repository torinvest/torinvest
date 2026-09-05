#!/usr/bin/env bash
# Fix définitif vidéo Module 0 (écran noir).
# Usage VPS:
#   bash /tmp/fix-module0-video-final.sh
set -euo pipefail

APP="${1:-$HOME/torinvest-formation}"
PORT=3001
PRIV_DIR="$APP/private/course/videos"
PUB_DIR="$APP/public/course/videos"
MEDIA_DIR="$APP/public/media"
NAME="module-0-socle.mp4"
PRIV="$PRIV_DIR/$NAME"
PUB="$PUB_DIR/$NAME"
HTML="$APP/private/course/intro-metier.html"
SERVER="$APP/server.js"

mkdir -p "$PRIV_DIR" "$PUB_DIR" "$MEDIA_DIR"

echo "== 1) Fichier source =="
if [[ ! -f "$PRIV" && -f "$PUB" ]]; then cp -a "$PUB" "$PRIV"; fi
if [[ ! -f "$PUB" && -f "$PRIV" ]]; then cp -a "$PRIV" "$PUB"; fi
if [[ ! -f "$PRIV" ]]; then
  echo "ERREUR: mp4 introuvable ($PRIV / $PUB)"
  exit 1
fi
ls -lh "$PRIV"

echo
echo "== 2) Codec / réencodage H.264 si besoin =="
if ! command -v ffprobe >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Installation ffmpeg…"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg
fi

VCODEC=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$PRIV" || true)
echo "codec vidéo: ${VCODEC:-inconnu}"
NEED_REENCODE=0
case "$VCODEC" in
  h264|avc1) echo "OK H.264" ;;
  *) NEED_REENCODE=1 ;;
esac

if [[ "$NEED_REENCODE" -eq 1 ]]; then
  echo "Réencodage H.264 (plusieurs minutes possibles)…"
  TMP="$PRIV_DIR/module-0-socle-h264.mp4"
  ffmpeg -y -i "$PRIV" \
    -vf "scale='min(1280,iw)':-2" \
    -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    "$TMP"
  cp -a "$PRIV" "$PRIV.bak.$(date +%Y%m%d%H%M%S)" || true
  mv -f "$TMP" "$PRIV"
fi

cp -a "$PRIV" "$PUB"
cp -a "$PRIV" "$MEDIA_DIR/$NAME"
ls -lh "$PRIV" "$MEDIA_DIR/$NAME"

echo
echo "== 3) HTML lecteur =="
if [[ ! -f "$HTML" ]]; then
  echo "ERREUR: $HTML manquant"
  exit 1
fi
cp -a "$HTML" "$HTML.bak-videofix-$(date +%Y%m%d%H%M%S)"
python3 - "$HTML" <<'PY'
from pathlib import Path
import re, sys
p = Path(sys.argv[1])
t = p.read_text(encoding="utf-8")
block = """<!-- FORGE_MODULE0_VIDEO_START -->
<figure class="forge-lesson-video" id="module0-video">
  <video id="module0VideoEl" controls playsinline preload="metadata" controlslist="nodownload"
    style="width:100%;max-width:960px;border-radius:12px;background:#000;display:block;margin:1.25rem auto;">
    <source src="/course/videos/module-0-socle.mp4" type="video/mp4" />
    <source src="/media/module-0-socle.mp4" type="video/mp4" />
  </video>
  <figcaption style="text-align:center;color:#9aa3b2;font-size:0.9rem;margin-top:0.5rem;">
    TORINVEST · La Forge — Le socle avant la technique
  </figcaption>
</figure>
<script>
(function () {
  var v = document.getElementById("module0VideoEl");
  if (!v) return;
  v.addEventListener("error", function () {
    if (v.dataset.fallbackTried) return;
    v.dataset.fallbackTried = "1";
    while (v.firstChild) v.removeChild(v.firstChild);
    v.src = "/media/module-0-socle.mp4";
    v.load();
  });
})();
</script>
<!-- FORGE_MODULE0_VIDEO_END -->"""
if "FORGE_MODULE0_VIDEO_START" in t:
    t = re.sub(
        r"<!-- FORGE_MODULE0_VIDEO_START -->.*?<!-- FORGE_MODULE0_VIDEO_END -->",
        block,
        t,
        count=1,
        flags=re.S,
    )
else:
    m = re.search(r"(<h1\b[^>]*>.*?</h1>)", t, flags=re.I | re.S)
    if m:
        t = t[: m.end()] + "\n\n" + block + "\n" + t[m.end() :]
    elif "</body>" in t.lower():
        t = re.sub(r"</body>", block + "\n</body>", t, count=1, flags=re.I)
    else:
        t = t + "\n" + block
p.write_text(t, encoding="utf-8")
pub = Path(str(p).replace("/private/course/", "/public/course/"))
if pub.parent.exists():
    pub.write_text(t, encoding="utf-8")
print("HTML OK")
PY

echo
echo "== 4) Route Express =="
node - "$SERVER" <<'NODE'
const fs = require("fs");
const serverPath = process.argv[1];
let src = fs.readFileSync(serverPath, "utf8");
const BEGIN = "/* TORINVEST_COURSE_VIDEOS_ROUTE_BEGIN */";
const END = "/* TORINVEST_COURSE_VIDEOS_ROUTE_END */";
const block = `${BEGIN}
// Vidéos formation — chemins absolus (indépendant du cwd pm2)
app.get(["/course/videos/:file", "/media/:file"], function torinvestCourseVideo(req, res, next) {
  try {
    const pathMod = require("path");
    const fsMod = require("fs");
    const name = pathMod.basename(String(req.params.file || ""));
    if (!name || !/\\.(mp4|webm|ogg)$/i.test(name)) return next();
    const root = __dirname;
    const candidates = [
      pathMod.join(root, "private", "course", "videos", name),
      pathMod.join(root, "public", "course", "videos", name),
      pathMod.join(root, "public", "media", name),
    ];
    const file = candidates.find((p) => fsMod.existsSync(p));
    if (!file) return res.status(404).type("text").send("video_not_found");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Accept-Ranges", "bytes");
    return res.sendFile(file, { acceptRanges: true });
  } catch (e) {
    return next(e);
  }
});
${END}
`;
const i0 = src.indexOf(BEGIN);
const i1 = src.indexOf(END);
if (i0 !== -1 && i1 !== -1 && i1 > i0) {
  src = src.slice(0, i0) + block + src.slice(i1 + END.length);
} else {
  // retire ancienne variante de marqueurs si présente
  src = src.replace(/\/\* TORINVEST_COURSE_VIDEOS_ROUTE_BEGIN \*\/[\s\S]*?\/\* TORINVEST_COURSE_VIDEOS_ROUTE_END \*\//g, "");
  const re = /app\.use\(\s*express\.static\(\s*["']public["']/;
  if (re.test(src)) src = src.replace(re, block + "\n$&");
  else if (/app\.listen\s*\(/.test(src)) src = src.replace(/app\.listen\s*\(/, block + "\napp.listen(");
  else {
    console.error("insertion impossible");
    process.exit(2);
  }
}
fs.writeFileSync(serverPath, src);
require("child_process").execFileSync(process.execPath, ["--check", serverPath], { stdio: "inherit" });
console.log("Route OK:", serverPath);
NODE

echo
echo "== 5) Restart =="
pm2 restart la-forge --update-env
sleep 2

echo
echo "== 6) Tests port ${PORT} =="
echo "-- /media (doit être 200 SANS cookie) --"
curl -sI "http://127.0.0.1:${PORT}/media/module-0-socle.mp4" | head -15
echo "-- /course/videos (302 sans cookie = normal) --"
curl -sI "http://127.0.0.1:${PORT}/course/videos/module-0-socle.mp4" | head -12

echo
echo "TEST NAVIGATEUR (important) :"
echo "  A) https://app.torinvest-trading.com/media/module-0-socle.mp4"
echo "  B) puis https://app.torinvest-trading.com/course/intro-metier.html  (Ctrl+Shift+R)"
echo "Dis-moi: A joue ? B joue ?"
