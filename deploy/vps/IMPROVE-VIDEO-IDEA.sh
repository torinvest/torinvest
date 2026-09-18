#!/usr/bin/env bash
# Améliore /tmp/video-idea_caa4e.webm → ~/video-idea_caa4e_improved.mp4
# À lancer SUR le VPS :
#   bash <(curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/video-idea-improve-691a/deploy/vps/IMPROVE-VIDEO-IDEA.sh)
set -euo pipefail
SRC="${1:-/tmp/video-idea_caa4e.webm}"
# aussi accepter la copie public
[[ -f "$SRC" ]] || SRC="$HOME/torinvest-formation/public/tmp-video-idea.webm"
OUT="${OUT:-$HOME/video-idea_caa4e_improved.mp4}"

echo "======== IMPROVE VIDEO ========"
ls -lah "$SRC"
command -v ffmpeg >/dev/null || { sudo apt-get update -y && sudo apt-get install -y ffmpeg; }

ffmpeg -y -i "$SRC" \
  -vf "hqdn3d=1.2:1.2:2.5:2.5,unsharp=5:5:0.5:5:5:0.0,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 192k -ac 2 -ar 48000 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
  -movflags +faststart \
  -metadata title="These Bitcoin — TORINVEST" \
  "$OUT"

# retire la copie publique temporaire
rm -f "$HOME/torinvest-formation/public/tmp-video-idea.webm" || true

ls -lah "$OUT"
echo "================ SUCCESS ================"
echo "Sur ton PC (PowerShell) :"
echo "  scp ubuntu@164.132.46.191:~/video-idea_caa4e_improved.mp4 \"\$env:USERPROFILE\\Downloads\\\""
echo "========================================="
