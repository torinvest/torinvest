#!/usr/bin/env python3
"""
Import Masterclass Macro — chapitre1.docx … chapitre23.docx → JSON.

Usage:
  python3 scripts/import-masterclass-docx.py \\
    --src private/masterclass-docx \\
    --out private/masterclass-content \\
    --seed deploy/vps/masterclass-seed

Contenu pédagogique hors Git public (private/ + seed/chapters/ gitignorés).
"""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def para_text(p: ET.Element) -> str:
    parts: list[str] = []
    for t in p.findall(".//w:t", W_NS):
        if t.text:
            parts.append(t.text)
    return "".join(parts).strip()


def para_style(p: ET.Element) -> str:
    style = p.find("./w:pPr/w:pStyle", W_NS)
    if style is None:
        return ""
    return (style.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val") or "").lower()


def is_heading(style: str, text: str) -> bool:
    if style.startswith("heading") or style.startswith("titre"):
        return True
    if re.match(r"^(chapitre|chapter)\s+\d+", text, re.I):
        return True
    if re.match(r"^\d{1,3}\.\s+\S", text) and len(text) < 180:
        return True
    return False


def extract_tables(root: ET.Element) -> list[dict]:
    tables: list[dict] = []
    for i, tbl in enumerate(root.findall(".//w:tbl", W_NS), start=1):
        rows: list[list[str]] = []
        for tr in tbl.findall("./w:tr", W_NS):
            cells: list[str] = []
            for tc in tr.findall("./w:tc", W_NS):
                cell_parts = []
                for p in tc.findall(".//w:p", W_NS):
                    t = para_text(p)
                    if t:
                        cell_parts.append(t)
                cells.append(" ".join(cell_parts).strip())
            if any(cells):
                rows.append(cells)
        if not rows:
            continue
        headers = rows[0]
        body = rows[1:] if len(rows) > 1 else []
        # normalize columns
        width = max(len(r) for r in rows)
        headers = (headers + [""] * width)[:width]
        body = [(r + [""] * width)[:width] for r in body]
        tables.append({"id": f"t{i}", "headers": headers, "rows": body})
    return tables


def docx_to_chapter(path: Path, number: int) -> dict:
    with zipfile.ZipFile(path) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    body = root.find("./w:body", W_NS)
    if body is None:
        raise RuntimeError(f"no body in {path}")

    tables = extract_tables(root)
    table_idx = 0

    sections: list[dict] = []
    current = {"id": "intro", "title": "Introduction", "blocks": []}
    title = f"Chapitre {number}"
    word_count = 0

    def flush():
        nonlocal current
        if current["blocks"] or current["id"] == "intro":
            # keep intro even if empty until we have content elsewhere
            if current["blocks"] or not sections:
                sections.append(current)

    for child in list(body):
        tag = child.tag.split("}")[-1]
        if tag == "tbl":
            if table_idx < len(tables):
                tid = tables[table_idx]["id"]
                current["blocks"].append({"type": "table", "tableId": tid})
                table_idx += 1
            continue
        if tag != "p":
            continue
        text = para_text(child)
        if not text:
            continue
        style = para_style(child)
        # "Chapitre N" glued to body text in the same paragraph
        glued = re.match(
            r"^(chapitre|chapter)\s+(\d+)\s*(.+)$", text, re.I | re.DOTALL
        )
        if (
            glued
            and len(sections) == 0
            and not current["blocks"]
            and len(glued.group(3).strip()) > 40
        ):
            title = f"Chapitre {number}"
            rest = glued.group(3).strip()
            current["blocks"].append({"type": "p", "text": rest})
            word_count += len(rest.split())
            continue

        if is_heading(style, text):
            # First chapter-like heading becomes document title
            if (
                re.match(r"^(chapitre|chapter|CHAPITRE)\b", text, re.I)
                and len(sections) == 0
                and not current["blocks"]
            ):
                # Prefer clean "Chapitre N — …" / "CHAPITRE N — …"
                title = text if len(text) <= 220 else f"Chapitre {number}"
                continue
            flush()
            sid = f"s{len(sections) + 1}"
            current = {"id": sid, "title": text, "blocks": []}
            continue
        current["blocks"].append({"type": "p", "text": text})
        word_count += len(text.split())

    flush()
    # drop empty intro if we have later sections
    if (
        sections
        and sections[0]["id"] == "intro"
        and not sections[0]["blocks"]
        and len(sections) > 1
    ):
        sections = sections[1:]

    # If title still generic, use first heading-like section
    if title == f"Chapitre {number}":
        for sec in sections:
            if sec["id"] != "intro" and sec["title"] and sec["title"] != "Introduction":
                title = f"Chapitre {number} — {sec['title']}"
                break

    slug = f"chapitre-{number}"
    return {
        "id": f"ch{number:02d}",
        "number": number,
        "title": title,
        "slug": slug,
        "status": "published",
        "objectives": [],
        "sections": sections,
        "tables": tables,
        "exercises": [],
        "quiz": [],
        "resources": [],
        "sourceFile": path.name,
        "wordCount": word_count,
    }


def chapter_index_entry(ch: dict) -> dict:
    return {
        "id": ch["id"],
        "number": ch["number"],
        "title": ch["title"],
        "slug": ch["slug"],
        "status": ch.get("status") or "published",
        "sectionsCount": len(ch.get("sections") or []),
        "tablesCount": len(ch.get("tables") or []),
        "wordCount": ch.get("wordCount") or 0,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", type=Path, default=Path("private/masterclass-docx"))
    ap.add_argument("--out", type=Path, default=Path("private/masterclass-content"))
    ap.add_argument("--seed", type=Path, default=Path("deploy/vps/masterclass-seed"))
    ap.add_argument("--tarball", type=Path, default=None)
    args = ap.parse_args()

    src: Path = args.src
    files = sorted(
        src.glob("chapitre*.docx"),
        key=lambda p: int(re.search(r"(\d+)", p.stem).group(1)),
    )
    if not files:
        raise SystemExit(f"Aucun chapitre*.docx dans {src}")

    out_chapters = args.out / "chapters"
    out_chapters.mkdir(parents=True, exist_ok=True)
    seed_chapters = args.seed / "chapters"
    seed_chapters.mkdir(parents=True, exist_ok=True)

    chapters_meta = []
    for path in files:
        m = re.search(r"(\d+)", path.stem)
        num = int(m.group(1)) if m else 0
        ch = docx_to_chapter(path, num)
        name = f"{num:02d}.json"
        payload = json.dumps(ch, ensure_ascii=False, indent=2) + "\n"
        (out_chapters / name).write_text(payload, encoding="utf-8")
        (seed_chapters / name).write_text(payload, encoding="utf-8")
        chapters_meta.append(chapter_index_entry(ch))
        print(f"OK {name}: {ch['title'][:70]}… ({ch['wordCount']} mots)")

    index = {
        "module": "masterclass-macro",
        "title": "Masterclass Macroéconomie & Marchés Financiers",
        "chapterCount": len(chapters_meta),
        "chapters": chapters_meta,
    }
    index_json = json.dumps(index, ensure_ascii=False, indent=2) + "\n"
    (args.out / "index.json").write_text(index_json, encoding="utf-8")
    (args.seed / "index.json").write_text(index_json, encoding="utf-8")
    print(f"Index: {len(chapters_meta)} chapitres")

    if args.tarball:
        import tarfile

        args.tarball.parent.mkdir(parents=True, exist_ok=True)
        with tarfile.open(args.tarball, "w:gz") as tar:
            for p in sorted(seed_chapters.glob("*.json")):
                tar.add(p, arcname=f"chapters/{p.name}")
        print(f"Tarball → {args.tarball}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
