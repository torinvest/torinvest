#!/usr/bin/env python3
"""
Place la video F2 exactement comme F1 :
- retire tout player colle sous le h1
- remplit / cree un slot data-video-id dans la grille lesson-layout
- reprend les classes du wrapper F1 si possible
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

    # --- Learn wrapper classes from F1 ---
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
        # Reuse F1 classes, swap video-id
        attrs2 = re.sub(
            r'data-video-id=["\'][^"\']+["\']',
            'data-video-id="f02-anatomie"',
            attrs,
            count=1,
            flags=re.I,
        )
        if 'id="' in attrs2.lower() or "id='" in attrs2.lower():
            attrs2 = re.sub(r'\sId=["\'][^"\']*["\']', "", attrs2, flags=re.I)
        wrap_open = f"<{tag}{attrs2}>"
        wrap_close = f"</{tag}>"
        print("F1 wrapper classes reutilisees:", wrap_open[:120])
    else:
        print("F1 slot introuvable — wrapper par defaut forge-lesson-video-slot")

    # Relative position hint from F1: index of h2 before video among h2s
    f01_h2s = list(re.finditer(r"<h2\b[^>]*>.*?</h2>", f01, flags=re.I | re.S))
    f01_vid = re.search(r'id=["\']f01-video["\']|f01-marches\.mp4|FORGE_F01_VIDEO', f01, flags=re.I)
    f01_h2_index = None
    if f01_vid and f01_h2s:
        for i, h in enumerate(f01_h2s):
            if h.start() < f01_vid.start():
                f01_h2_index = i
        print(f"F1: video apres h2 index={f01_h2_index} (0-based), total h2={len(f01_h2s)}")

    # --- Strip ALL existing F2 video placements ---
    f02 = re.sub(re.escape(ms) + r".*?" + re.escape(me), "", f02, flags=re.S)
    f02 = re.sub(
        r'<figure[^>]*id=["\']f02-video["\'][^>]*>.*?</figure>',
        "",
        f02,
        flags=re.I | re.S,
    )
    f02 = re.sub(
        r'<section[^>]*(?:id=["\']f02-video-slot["\']|data-video-id=["\']f02-[^"\']*["\'])[^>]*>[\s\S]*?</section>',
        "",
        f02,
        flags=re.I,
    )
    # Empty leftover wrappers that only contained the player
    f02 = re.sub(
        r'<(div|section|aside|article)(\s[^>]*data-video-id=["\']f02-[^"\']*["\'][^>]*)>\s*</\1\s*>',
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
    # Remove orphan caption/title we may have injected under h1
    f02 = re.sub(
        r'(</h1\s*>)\s*(?:<!-- FORGE_F02[\s\S]*?-->\s*)?(?:<section[^>]*>\s*)?(?:<h2[^>]*>Video[^<]*</h2>\s*)?',
        r"\1\n",
        f02,
        count=1,
        flags=re.I,
    )

    block = f"{wrap_open}\n{player}\n{wrap_close}"
    action = None

    # A) Existing f02 / any Integration-video data-video-id slot
    for pat, label in (
        (
            r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\'][^"\']*f02[^"\']*["\'][^>]*)>(.*?)</\1\s*>',
            "rempli slot data-video-id f02",
        ),
        (
            r'<(div|section|aside|figure|article)(\s[^>]*data-video-id=["\'][^"\']+["\'][^>]*)>([^<]{0,600}?Int[ée]gration\s+vid[ée]o[\s\S]{0,400}?)</\1\s*>',
            "rempli placeholder Integration video",
        ),
    ):
        m = re.search(pat, f02, flags=re.I | re.S)
        if m:
            tag, attrs = m.group(1), m.group(2)
            f02 = f02[: m.start()] + f"<{tag}{attrs}>\n{player}\n</{tag}>" + f02[m.end() :]
            action = label
            break

    # B) Under an existing "Video — …" heading
    if action is None:
        mtit = re.search(
            r"(<h[2-4][^>]*>\s*(?:Video|Vidéo)\s*[—\-:].*?</h[2-4]>)",
            f02,
            flags=re.I | re.S,
        )
        if mtit:
            after = mtit.end()
            p = re.match(r"\s*<p\b[^>]*>.*?</p>", f02[after:], flags=re.I | re.S)
            if p:
                after += p.end()
            f02 = f02[:after] + "\n" + block + "\n" + f02[after:]
            action = "sous titre Video existant"

    # C) Mirror F1 h2 index: insert after the same ordinal h2, with a Video heading
    if action is None and f01_h2_index is not None:
        f02_h2s = list(re.finditer(r"<h2\b[^>]*>.*?</h2>", f02, flags=re.I | re.S))
        if f02_h2s:
            idx = min(f01_h2_index, len(f02_h2s) - 1)
            # Prefer not the very first h2 if many exist (avoid top); use F1 index
            anchor = f02_h2s[idx]
            # Insert AFTER the section that starts at this h2: find end of following content block
            # Simple: after the h2 + optional lead paragraph, still within same parent
            after = anchor.end()
            p = re.match(r"\s*<p\b[^>]*>.*?</p>", f02[after:], flags=re.I | re.S)
            if p:
                after += p.end()
            section = (
                '\n<section class="forge-lesson-video-section" id="f02-video-section">\n'
                '<h2 class="forge-lesson-video-heading">Video — Anatomie de l or en conditions reelles</h2>\n'
                '<p class="forge-lesson-video-lead">Sessions, volatilite et correlations sur XAUUSD.</p>\n'
                f"{block}\n"
                "</section>\n"
            )
            f02 = f02[:after] + section + f02[after:]
            action = f"miroir F1 apres h2[{idx}] + section Video"

    # D) Before quiz / pratique / validation
    if action is None:
        m = re.search(
            r'(<h[2-4][^>]*>\s*(?:Quiz|Pratique|Validation|Exercice|Synthese|Synthèse)[^<]*</h[2-4]>)',
            f02,
            flags=re.I,
        )
        if m:
            section = (
                '\n<section class="forge-lesson-video-section" id="f02-video-section">\n'
                '<h2 class="forge-lesson-video-heading">Video — Anatomie de l or en conditions reelles</h2>\n'
                '<p class="forge-lesson-video-lead">Sessions, volatilite et correlations sur XAUUSD.</p>\n'
                f"{block}\n"
                "</section>\n"
            )
            f02 = f02[: m.start()] + section + f02[m.start() :]
            action = "avant Quiz/Pratique"

    # E) After 2nd h2 (mid-module), never after h1 alone
    if action is None:
        f02_h2s = list(re.finditer(r"<h2\b[^>]*>.*?</h2>", f02, flags=re.I | re.S))
        if len(f02_h2s) >= 2:
            after = f02_h2s[1].end()
            p = re.match(r"\s*<p\b[^>]*>.*?</p>", f02[after:], flags=re.I | re.S)
            if p:
                after += p.end()
            section = (
                '\n<section class="forge-lesson-video-section" id="f02-video-section">\n'
                '<h2 class="forge-lesson-video-heading">Video — Anatomie de l or en conditions reelles</h2>\n'
                f"{block}\n"
                "</section>\n"
            )
            f02 = f02[:after] + section + f02[after:]
            action = "apres 2e h2 (milieu module)"
        elif f02_h2s:
            after = f02_h2s[0].end()
            section = (
                '\n<section class="forge-lesson-video-section" id="f02-video-section">\n'
                '<h2 class="forge-lesson-video-heading">Video — Anatomie de l or en conditions reelles</h2>\n'
                f"{block}\n"
                "</section>\n"
            )
            f02 = f02[:after] + section + f02[after:]
            action = "apres 1er h2"
        else:
            print("ERREUR: aucune structure de lecon exploitable", file=sys.stderr)
            for i, line in enumerate(f02.splitlines(), 1):
                if re.search(r"<h[1-3]|data-video|lesson", line, flags=re.I):
                    print(f"  L{i}: {line[:160]}", file=sys.stderr)
            return 2

    if "forge-lesson-video.css" not in f02 and "</head>" in f02:
        f02 = f02.replace(
            "</head>",
            '  <link rel="stylesheet" href="/css/forge-lesson-video.css?v=f02b" />\n</head>',
            1,
        )
    else:
        f02 = re.sub(
            r'forge-lesson-video\.css(\?v=[^"]*)?',
            "forge-lesson-video.css?v=f02b",
            f02,
            count=1,
        )

    f02 = re.sub(r"\n{4,}", "\n\n\n", f02)
    f02_path.write_text(f02, encoding="utf-8")
    print("Action :", action)

    # Guard: not glued to h1
    m = re.search(r"</h1\s*>", f02, flags=re.I)
    if m and ("f02-xauusd.mp4" in f02[m.end() : m.end() + 500]):
        print("WARN: encore proche du h1 — structure F2 atypique", file=sys.stderr)
    if "f02-xauusd.mp4" not in f02:
        print("ERREUR: mp4 absent", file=sys.stderr)
        return 3
    if f02.count('id="f02-video"') != 1:
        print("WARN: nb #f02-video =", f02.count('id="f02-video"'), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
