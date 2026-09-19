#!/usr/bin/env bash
# Améliore une vidéo idée → MP4 1080p + transitions + musique + sous-titres FR brûlés.
# À lancer SUR le VPS (ubuntu@164.132.46.191) :
#   bash <(curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/video-idea-improve-691a/deploy/vps/IMPROVE-VIDEO-IDEA.sh)
#
# Modes :
#   1) qualité seule (défaut rapide) → ~/video-idea_caa4e_improved.mp4
#   2) FINAL=1 → coupe chapitres + musique + SRT → ~/video-idea_caa4e_FINAL.mp4
#      (nécessite whisper CLI si SRT absent ; sinon passe -i chemin.srt)
set -euo pipefail

SRC="${1:-/tmp/video-idea_caa4e.webm}"
[[ -f "$SRC" ]] || SRC="$HOME/torinvest-formation/public/tmp-video-idea.webm"
OUT_IMPROVED="${OUT_IMPROVED:-$HOME/video-idea_caa4e_improved.mp4}"
OUT_FINAL="${OUT_FINAL:-$HOME/video-idea_caa4e_FINAL.mp4}"
WORK="${WORK:-/tmp/video-improve-vps}"
FINAL="${FINAL:-0}"
SRT_IN="${SRT:-}"

echo "======== IMPROVE VIDEO ========"
ls -lah "$SRC"
command -v ffmpeg >/dev/null || { sudo apt-get update -y && sudo apt-get install -y ffmpeg; }
mkdir -p "$WORK"

# 1) qualité de base
ffmpeg -y -i "$SRC" \
  -vf "hqdn3d=1.2:1.2:2.5:2.5,unsharp=5:5:0.5:5:5:0.0,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 192k -ac 2 -ar 48000 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
  -movflags +faststart \
  -metadata title="These Bitcoin — TORINVEST" \
  "$OUT_IMPROVED"

rm -f "$HOME/torinvest-formation/public/tmp-video-idea.webm" || true
ls -lah "$OUT_IMPROVED"

if [[ "$FINAL" != "1" ]]; then
  echo "================ SUCCESS (qualité) ================"
  echo "Pour FINAL (coupes+musique+sous-titres) :"
  echo "  FINAL=1 bash $0"
  echo "SCP :"
  echo "  scp ubuntu@164.132.46.191:~/video-idea_caa4e_improved.mp4 \"\$env:USERPROFILE\\Downloads\\\""
  echo "==================================================="
  exit 0
fi

echo "======== FINAL : chapitres + musique + sous-titres ========"
# Chapitres (coupes avec fade) — bornes adaptées à la thèse Bitcoin
# 0 intro/dette | 1 rareté | 2 or/btc | 3 adoption | 4 risque | 5 conclusion
CUTS=(0 92.4 156.7 189.3 269.2 394.0)
DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT_IMPROVED")
CUTS+=("$DUR")

rm -f "$WORK"/seg_*.mp4 "$WORK"/concat.txt
for i in $(seq 0 $((${#CUTS[@]}-2))); do
  s="${CUTS[$i]}"; e="${CUTS[$((i+1))]}"
  len=$(python3 -c "print(max(0.2, float('$e')-float('$s')))")
  ffmpeg -y -ss "$s" -t "$len" -i "$OUT_IMPROVED" \
    -vf "fade=t=in:st=0:d=0.35,fade=t=out:st=$(python3 -c "print(max(0, float('$len')-0.4))"):d=0.35" \
    -af "afade=t=in:st=0:d=0.25,afade=t=out:st=$(python3 -c "print(max(0, float('$len')-0.35))"):d=0.3" \
    -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
    -c:a aac -b:a 160k -ar 48000 -ac 2 \
    "$WORK/seg_$(printf '%02d' "$i").mp4"
  echo "file 'seg_$(printf '%02d' "$i").mp4'" >> "$WORK/concat.txt"
done
( cd "$WORK" && ffmpeg -y -f concat -safe 0 -i concat.txt -c copy video_chapters.mp4 )

# Voix seule + lit ambiant + duck
ffmpeg -y -i "$WORK/video_chapters.mp4" -vn -c:a aac -b:a 160k -ar 48000 -ac 2 "$WORK/voice_only.m4a"
VDUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$WORK/voice_only.m4a")
VDUR_INT=${VDUR%.*}
ffmpeg -y \
  -f lavfi -i "sine=frequency=55:sample_rate=48000:duration=$VDUR" \
  -f lavfi -i "sine=frequency=82.5:sample_rate=48000:duration=$VDUR" \
  -f lavfi -i "sine=frequency=110:sample_rate=48000:duration=$VDUR" \
  -f lavfi -i "anoisesrc=color=pink:sample_rate=48000:amplitude=0.02:duration=$VDUR" \
  -filter_complex "\
[0:a]volume=0.20,afade=t=in:st=0:d=3,afade=t=out:st=$((VDUR_INT-4)):d=4[l1];\
[1:a]volume=0.14,tremolo=f=0.12:d=0.35,afade=t=in:st=0:d=4,afade=t=out:st=$((VDUR_INT-4)):d=4[l2];\
[2:a]volume=0.08,tremolo=f=0.18:d=0.4,afade=t=in:st=2:d=5,afade=t=out:st=$((VDUR_INT-5)):d=5[l3];\
[3:a]lowpass=f=450,volume=0.5,afade=t=in:st=0:d=2,afade=t=out:st=$((VDUR_INT-3)):d=3[n];\
[l1][l2][l3][n]amix=inputs=4:duration=longest:normalize=0,alimiter=limit=0.4[out]" \
  -map "[out]" -c:a aac -b:a 160k -ar 48000 "$WORK/bg_ambient.m4a"

ffmpeg -y -i "$WORK/voice_only.m4a" -i "$WORK/bg_ambient.m4a" \
  -filter_complex "\
[0:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11,asplit=2[v1][v2];\
[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.65[bg];\
[bg][v1]sidechaincompress=threshold=0.05:ratio=3.5:attack=180:release=1000:level_sc=0.85:makeup=1.6[ducked];\
[v2][ducked]amix=inputs=2:duration=first:dropout_transition=2:normalize=0,alimiter=limit=0.95[aout]" \
  -map "[aout]" -c:a aac -b:a 192k -ac 2 -ar 48000 "$WORK/mix.m4a"

ffmpeg -y -i "$WORK/video_chapters.mp4" -i "$WORK/mix.m4a" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ac 2 -ar 48000 -shortest \
  "$WORK/video_with_music.mp4"

# Sous-titres
SRT="$WORK/narration.srt"
if [[ -n "$SRT_IN" && -f "$SRT_IN" ]]; then
  cp "$SRT_IN" "$SRT"
elif command -v whisper >/dev/null 2>&1; then
  ffmpeg -y -i "$WORK/voice_only.m4a" -ac 1 -ar 16000 "$WORK/narration.wav"
  whisper "$WORK/narration.wav" --language fr --model small --output_format srt --output_dir "$WORK"
  mv "$WORK/narration.srt" "$SRT" 2>/dev/null || true
else
  echo "WARN: pas de whisper ni SRT — FINAL sans sous-titres brûlés"
  cp "$WORK/video_with_music.mp4" "$OUT_FINAL"
  ls -lah "$OUT_FINAL"
  exit 0
fi

# SRT → ASS basique
python3 - <<PY
import re, pathlib
srt = pathlib.Path("$SRT").read_text(encoding="utf-8", errors="replace")
def ts(hms):
    h,m,rest=hms.split(":")
    s,ms=rest.split(",")
    return f"{int(h)}:{m}:{s}.{ms[:2]}"
events=[]
for block in re.split(r"\n\s*\n", srt.strip()):
    lines=block.strip().splitlines()
    if len(lines)<3: continue
    m=re.match(r"(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})", lines[1])
    if not m: continue
    text=" ".join(lines[2:]).replace("\n"," ").replace(",","\\,")
    events.append(f"Dialogue: 0,{ts(m.group(1))},{ts(m.group(2))},Default,,0,0,0,,{text}")
ass="""[Script Info]
Title: These Bitcoin TORINVEST
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,80,80,70,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(events) + "\n"
pathlib.Path("$WORK/subs.ass").write_text(ass, encoding="utf-8")
print("ASS lines", len(events))
PY

ffmpeg -y -i "$WORK/video_with_music.mp4" \
  -vf "ass=$WORK/subs.ass" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p \
  -c:a copy -movflags +faststart \
  -metadata title="These Bitcoin — TORINVEST (coupes + musique + sous-titres)" \
  "$OUT_FINAL"

ls -lah "$OUT_FINAL"
echo "================ SUCCESS (FINAL) ================"
echo "  scp ubuntu@164.132.46.191:~/video-idea_caa4e_FINAL.mp4 \"\$env:USERPROFILE\\Downloads\\\""
echo "================================================="
