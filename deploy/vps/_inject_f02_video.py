#!/usr/bin/env python3
"""Inject F2 video into f02-xauusd.html — same placement as F0/F1 (data-video-id slot)."""
import re
import sys
from pathlib import Path

html_path = Path(sys.argv[1])
video_url, caption = sys.argv[2], sys.argv[3]
# title unused — F1 does not inject a custom h2 inside the slot
text = html_path.read_text(encoding="utf-8")

ms, me = "<!-- FORGE_F02_VIDEO_START -->", "<!-- FORGE_F02_VIDEO_END -->"

# Same markup as F1 HOTFIX-F01-VIDEO-LAYOUT: figure only INSIDE existing data-video-id wrapper.
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

# 1) Remove misplaced F2 player (often right under page h1)
text = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", text, flags=re.S)
text = re.sub(
    r'<figure[^>]*id=["\']f02-video["\'][^>]*>.*?</figure>',
    "",
    text,
    flags=re.I | re.S,
)
text = re.sub(
    r'<section[^>]*(?:id=["\']f02-video-slot["\']|class=["\'][^"\']*forge-lesson-video-slot[^"\']*["\'][^>]*data-video-id=["\']f02-[^"\']*["\'])[^>]*>[\s\S]*?</section>',
    "",
    text,
    flags=re.I,
)
text = re.sub(
    r'<h2[^>]*>\s*(?:Video|Vidéo)\s*[—\-]\s*XAUUSD[^<]*</h2>\s*',
    "",
    text,
    flags=re.I,
)

action = None


def fill_slot(pattern, label):
    global text, action
    m = re.search(pattern, text, flags=re.I | re.S)
    if not m:
        return False
    tag, attrs = m.group(1), m.group(2)
    text = text[: m.start()] + f"<{tag}{attrs}>\n{inner}\n</{tag}>" + text[m.end() :]
    action = label
    return True


# 2a) Slot data-video-id containing f02 (like f01-microstructure)
if fill_slot(
    r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\'][^"\']*f02[^"\']*["\'][^>]*)>(.*?)</\1\s*>',
    "contenu interieur data-video-id f02",
):
    pass
# 2b) Any data-video-id still showing Integration video placeholder
elif fill_slot(
    r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\'][^"\']+["\'][^>]*)>([^<]{0,500}?Int[ée]gration\s+vid[ée]o[\s\S]{0,300}?)</\1\s*>',
    "contenu interieur placeholder Integration video",
):
    pass
else:
    # 2c) Under section heading "Video — …" (same as F1 Microstructure title)
    mtit = re.search(
        r"(<h[2-4][^>]*>\s*(?:Video|Vidéo)\s*[—\-:].*?</h[2-4]>)",
        text,
        flags=re.I | re.S,
    )
    if mtit:
        after = mtit.end()
        p = re.match(r"\s*<p\b[^>]*>.*?</p>", text[after:], flags=re.I | re.S)
        if p:
            after = after + p.end()
        wrap = (
            f'\n<div class="forge-lesson-video-slot" data-video-id="f02-anatomie">\n'
            f"{inner}\n</div>\n"
        )
        text = text[:after] + wrap + text[after:]
        action = "insere sous titre section Video (wrapper slot)"
    else:
        ph = re.search(
            r'(<(?:div|section|aside|figure|article)\b[^>]*>)([^<]{0,200}?Int[ée]gration\s+vid[ée]o[\s\S]{0,200}?)(</(?:div|section|aside|figure|article)\s*>)',
            text,
            flags=re.I,
        )
        if ph:
            text = (
                text[: ph.start()]
                + ph.group(1)
                + "\n"
                + inner
                + "\n"
                + ph.group(3)
                + text[ph.end() :]
            )
            action = "remplace bloc Integration video a venir"
        else:
            print("ERREUR: slot video F2 introuvable (comme F0/F1)", file=sys.stderr)
            for needle in (
                "data-video-id",
                "f02",
                "Integration video",
                "Intégration vidéo",
                "Vidéo",
                "Video",
            ):
                print(f"  {needle!r}: {needle.lower() in text.lower()}", file=sys.stderr)
            for i, line in enumerate(text.splitlines(), 1):
                if re.search(
                    r"data-video|Int[ée]gration|Vidéo\s*[—\-]|Video\s*[—\-]",
                    line,
                    flags=re.I,
                ):
                    print(f"  L{i}: {line[:160]}", file=sys.stderr)
            sys.exit(2)

if "forge-lesson-video.css" not in text and "</head>" in text:
    text = text.replace(
        "</head>",
        '  <link rel="stylesheet" href="/css/forge-lesson-video.css?v=f02" />\n</head>',
        1,
    )
else:
    text = re.sub(
        r'forge-lesson-video\.css(\?v=[^"]*)?',
        "forge-lesson-video.css?v=f02",
        text,
        count=1,
    )

text = re.sub(r"\n{4,}", "\n\n\n", text)
html_path.write_text(text, encoding="utf-8")
print("Action :", action)
if "f02-xauusd.mp4" not in text:
    print("ERREUR: mp4 absent apres patch", file=sys.stderr)
    sys.exit(3)
