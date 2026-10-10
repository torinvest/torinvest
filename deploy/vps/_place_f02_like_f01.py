#!/usr/bin/env python3
"""
Place la video F2 comme F1 :
- retire le player colle en haut (sous h1 / debut de page)
- recree une section Video + slot (classes F1 si dispo)
- l insert avant Exercice / Evaluation / Cas (milieu de lecon)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 4:
        print(
            "usage: _place_f02_like_f01.py <f02.html> <f01.html> <video_url> [caption]",
            file=sys.stderr,
        )
        return 2

    f02_path = Path(sys.argv[1])
    f01_path = Path(sys.argv[2])
    video_url = sys.argv[3]
    caption = sys.argv[4] if len(sys.argv) > 4 else "TORINVEST La Forge - F2 XAUUSD"

    f02 = f02_path.read_text(encoding="utf-8", errors="replace")
    f01 = f01_path.read_text(encoding="utf-8", errors="replace") if f01_path.is_file() else ""

    ms, me = "<!-- FORGE_F02_VIDEO_START -->", "<!-- FORGE_F02_VIDEO_END -->"

    # Markup F1 : figure seule, PAS de h2 dans la figure
    player = f"""{ms}
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

    wrap_open = '<div class="forge-lesson-video-slot" data-video-id="f02-anatomie">'
    wrap_close = "</div>"
    f01_slot = re.search(
        r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\']f01-microstructure["\'][^>]*)>',
        f01,
        flags=re.I,
    )
    if f01_slot:
        tag = f01_slot.group(1)
        attrs = f01_slot.group(2)
        attrs2 = re.sub(
            r'data-video-id=["\'][^"\']+["\']',
            'data-video-id="f02-anatomie"',
            attrs,
            count=1,
            flags=re.I,
        )
        attrs2 = re.sub(r'\sId=["\'][^"\']*["\']', "", attrs2, flags=re.I)
        wrap_open = f"<{tag}{attrs2}>"
        wrap_close = f"</{tag}>"
        print("F1 wrapper:", wrap_open[:140])
    else:
        print("F1 slot absent — wrapper par defaut")

    # --- Purge ALL previous F2 video blocks (including current misplaced top slot) ---
    f02 = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", f02, flags=re.S)
    f02 = re.sub(
        r'<figure[^>]*id=["\']f02-video["\'][^>]*>.*?</figure>',
        "",
        f02,
        flags=re.I | re.S,
    )
    f02 = re.sub(
        r'<section[^>]*(?:id=["\']f02-video-slot["\']|id=["\']f02-video-section["\']|data-video-id=["\']f02-[^"\']*["\']|class=["\'][^"\']*forge-lesson-video-slot[^"\']*["\'])[^>]*>[\s\S]*?</section>',
        "",
        f02,
        flags=re.I,
    )
    f02 = re.sub(
        r'<(div|aside|article)(\s[^>]*data-video-id=["\']f02-[^"\']*["\'][^>]*)>[\s\S]*?</\1\s*>',
        "",
        f02,
        flags=re.I,
    )
    f02 = re.sub(
        r'<h2[^>]*>\s*(?:Video|Vidéo)\s*[—\-]\s*(?:XAUUSD|Anatomie)[^<]*</h2>\s*',
        "",
        f02,
        flags=re.I,
    )
    f02 = re.sub(r"\n{3,}", "\n\n", f02)

    section = (
        '\n<section class="forge-lesson-video-section" id="f02-video-section">\n'
        '<h2 class="forge-lesson-video-heading">Video — Anatomie de l or en conditions reelles</h2>\n'
        '<p class="forge-lesson-video-lead">Sessions, volatilite et correlations sur XAUUSD.</p>\n'
        f"{wrap_open}\n{player}\n{wrap_close}\n"
        "</section>\n"
    )

    action = None

    # Prefer existing empty Integration / data-video slot if any remain
    m = re.search(
        r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\'][^"\']+["\'][^>]*)>([^<]{0,600}?Int[ée]gration\s+vid[ée]o[\s\S]{0,400}?)</\1\s*>',
        f02,
        flags=re.I,
    )
    if m:
        tag, attrs = m.group(1), m.group(2)
        f02 = f02[: m.start()] + f"<{tag}{attrs}>\n{player}\n</{tag}>" + f02[m.end() :]
        action = "rempli placeholder Integration video"
    else:
        # Insert BEFORE mid/late lesson anchors (F2 real headings from live HTML)
        anchors = [
            r'(<h[2-4][^>]*>\s*Exercice[^<]*</h[2-4]>)',
            r'(<h[2-4][^>]*>\s*Exercices\s+pratiques[^<]*</h[2-4]>)',
            r'(<h[2-4][^>]*>\s*[ÉE]valuation[^<]*</h[2-4]>)',
            r'(<h[2-4][^>]*>\s*Cas\s+XAUUSD[^<]*</h[2-4]>)',
            r'(<h[2-4][^>]*>\s*Quiz[^<]*</h[2-4]>)',
            r'(<h[2-4][^>]*>\s*Pratique[^<]*</h[2-4]>)',
        ]
        for pat in anchors:
            m = re.search(pat, f02, flags=re.I)
            if m:
                f02 = f02[: m.start()] + section + f02[m.start() :]
                action = f"avant {m.group(1)[:60]}"
                break

    if action is None:
        # After "Objectifs du module" if present
        m = re.search(
            r'(<h[2-4][^>]*>\s*Objectifs[^<]*</h[2-4]>)([\s\S]{0,2500}?)(?=<h[2-4]\b)',
            f02,
            flags=re.I,
        )
        if m:
            f02 = f02[: m.end()] + section + f02[m.end() :]
            action = "apres Objectifs du module"
        else:
            # Mirror F1 h2 index
            f01_h2s = list(re.finditer(r"<h2\b[^>]*>.*?</h2>", f01, flags=re.I | re.S))
            f01_vid = re.search(
                r'id=["\']f01-video["\']|f01-marches\.mp4|FORGE_F01_VIDEO', f01, flags=re.I
            )
            f01_h2_index = None
            if f01_vid and f01_h2s:
                for i, h in enumerate(f01_h2s):
                    if h.start() < f01_vid.start():
                        f01_h2_index = i
            f02_h2s = list(re.finditer(r"<h2\b[^>]*>.*?</h2>", f02, flags=re.I | re.S))
            if f02_h2s:
                idx = 1 if len(f02_h2s) > 1 else 0
                if f01_h2_index is not None:
                    idx = min(f01_h2_index, len(f02_h2s) - 1)
                after = f02_h2s[idx].end()
                p = re.match(r"\s*<p\b[^>]*>.*?</p>", f02[after:], flags=re.I | re.S)
                if p:
                    after += p.end()
                f02 = f02[:after] + section + f02[after:]
                action = f"apres h2[{idx}]"
            else:
                print("ERREUR: structure F2 inexploitable", file=sys.stderr)
                for i, line in enumerate(f02.splitlines(), 1):
                    if re.search(r"<h[1-3]|Objectifs|Exercice|Evaluation|Cas XAU", line, flags=re.I):
                        print(f"  L{i}: {line[:160]}", file=sys.stderr)
                return 2

    if "forge-lesson-video.css" not in f02 and "</head>" in f02:
        f02 = f02.replace(
            "</head>",
            '  <link rel="stylesheet" href="/css/forge-lesson-video.css?v=f02c" />\n</head>',
            1,
        )
    else:
        f02 = re.sub(
            r'forge-lesson-video\.css(\?v=[^"]*)?',
            "forge-lesson-video.css?v=f02c",
            f02,
            count=1,
        )

    f02 = re.sub(r"\n{4,}", "\n\n\n", f02)
    f02_path.write_text(f02, encoding="utf-8")
    print("Action :", action)

    # Guards
    if f02.count("f02-xauusd.mp4") != 1:
        print("WARN: occurrences mp4 =", f02.count("f02-xauusd.mp4"), file=sys.stderr)
    if f02.count('id="f02-video"') != 1:
        print("WARN: nb #f02-video =", f02.count('id="f02-video"'), file=sys.stderr)

    m = re.search(r"</h1\s*>", f02, flags=re.I)
    if m and "f02-xauusd.mp4" in f02[m.end() : m.end() + 600]:
        print("ERREUR: video encore trop proche du h1", file=sys.stderr)
        return 3

    # Must appear before Exercice/Evaluation if those exist
    for label in ("Exercice", "Évaluation", "Evaluation", "Quiz"):
        pos = re.search(rf"<h[2-4][^>]*>\s*{label}", f02, flags=re.I)
        vid = f02.find("f02-xauusd.mp4")
        if pos and vid != -1 and vid > pos.start():
            print(f"WARN: video apres {label} (attendu avant)", file=sys.stderr)

    print("OK placement F2")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
