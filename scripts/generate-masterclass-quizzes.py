#!/usr/bin/env python3
"""
Génère quiz (3–5 Q) + examen de validation (5 Q) pour chaque chapitre Masterclass.
Questions dérivées du contenu pédagogique (pas inventées hors chapitre).
"""
from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path

# Distractors génériques (inversions logiques courantes)
GENERIC_WRONG = [
    "L’offre d’obligations n’a aucun effet sur les rendements.",
    "Le prix et le rendement d’une obligation évoluent toujours dans le même sens.",
    "Seules les statistiques officielles du PIB suffisent à anticiper les marchés.",
    "La Fed contrôle directement et seul le niveau des yields longs à tout instant.",
    "Un investisseur peut ignorer la duration et la liquidité sans conséquence.",
    "Les flux institutionnels sont négligeables face aux flux retail.",
    "QE et QT ont le même effet sur les réserves et les conditions financières.",
    "Le dollar et le carry trade n’influencent jamais les rendements US.",
]


def paragraphs(chapter: dict) -> list[tuple[str, str]]:
    out = []
    for sec in chapter.get("sections") or []:
        title = sec.get("title") or ""
        for b in sec.get("blocks") or []:
            if b.get("type") == "p" and b.get("text"):
                t = re.sub(r"\s+", " ", b["text"]).strip()
                if len(t) >= 45:
                    out.append((title, t))
    return out


def is_teaching(text: str) -> bool:
    if text.startswith("TORINVEST"):
        return False
    if re.match(r"^(Oui\.|Non\.|Chapitre|CHAPITRE|Je te propose)", text):
        return False
    markers = (
        "→",
        "↑",
        "↓",
        "parce que",
        "c’est",
        "c'est",
        "donc",
        "lorsque",
        "quand",
        "si ",
        "mécanique",
        "rendement",
        "duration",
        "liquidité",
        "Fed",
        "Treasury",
        "flux",
        "courbe",
        "QE",
        "QT",
        "TGA",
        "réserves",
        "inflation",
        "scénario",
    )
    low = text.lower()
    return any(m.lower() in low or m in text for m in markers)


def invert_arrows(text: str) -> str | None:
    if "→" not in text and "↑" not in text and "↓" not in text:
        return None
    t = text
    # swap up/down carefully via placeholders
    t = t.replace("↑", "§UP§").replace("↓", "§DOWN§")
    t = t.replace("§UP§", "↓").replace("§DOWN§", "↑")
    # reverse simple A → B into B → A when short
    if "→" in t and t.count("→") == 1 and len(t) < 160:
        left, right = t.split("→", 1)
        t = right.strip() + " → " + left.strip()
        t = t[0].upper() + t[1:] if t else t
    if t == text:
        return None
    return t


def pick_facts(paras: list[tuple[str, str]], n: int) -> list[str]:
    candidates = []
    for _title, text in paras:
        if not is_teaching(text):
            continue
        if len(text) > 220:
            # truncate at sentence
            m = re.search(r"^(.{80,200}[\.!?])\s", text)
            text = m.group(1) if m else text[:200].rsplit(" ", 1)[0] + "…"
        candidates.append(text)
    # prefer arrow/rule sentences
    scored = []
    for c in candidates:
        score = 0
        if any(x in c for x in ("→", "↑", "↓")):
            score += 3
        if re.search(r"\d", c):
            score += 1
        if len(c) < 180:
            score += 1
        scored.append((score, c))
    scored.sort(key=lambda x: (-x[0], len(x[1])))
    seen = set()
    out = []
    for _, c in scored:
        key = c[:60].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
        if len(out) >= n:
            break
    return out


def make_mcq(qid: str, fact: str, other_facts: list[str], rng: random.Random) -> dict:
    wrongs = []
    inv = invert_arrows(fact)
    if inv and inv != fact:
        wrongs.append(inv)
    for f in other_facts:
        if f == fact:
            continue
        if abs(len(f) - len(fact)) > 120:
            continue
        wrongs.append(f)
        if len(wrongs) >= 3:
            break
    while len(wrongs) < 3:
        w = rng.choice(GENERIC_WRONG)
        if w not in wrongs and w != fact:
            wrongs.append(w)
    choices = [fact] + wrongs[:3]
    rng.shuffle(choices)
    answer = choices.index(fact)
    explain = "Selon le chapitre : « " + fact[:160] + ("…" if len(fact) > 160 else "") + " »"
    return {
        "id": qid,
        "type": "mcq",
        "prompt": "Quelle affirmation est cohérente avec le raisonnement du chapitre ?",
        "choices": choices,
        "answer": answer,
        "explain": explain,
    }


def make_scenario_q(qid: str, fact: str, rng: random.Random) -> dict | None:
    """Question type : vraie / fausse reformulée en MCQ 2 options étendues."""
    inv = invert_arrows(fact)
    if not inv:
        return None
    prompt = "Parmi ces deux lectures de marché, laquelle suit la logique du chapitre ?"
    choices = [fact, inv]
    # add two more distractors
    for w in GENERIC_WRONG:
        if w not in choices:
            choices.append(w)
        if len(choices) >= 4:
            break
    rng.shuffle(choices)
    return {
        "id": qid,
        "type": "mcq",
        "prompt": prompt,
        "choices": choices[:4],
        "answer": choices.index(fact),
        "explain": "La bonne lecture reprend la mécanique enseignée dans le chapitre.",
    }


def make_section_q(qid: str, section_title: str, fact: str, rng: random.Random) -> dict:
    prompt = f"Sur le thème « {section_title[:80]} », que retenir ?"
    inv = invert_arrows(fact) or rng.choice(GENERIC_WRONG)
    others = [inv, rng.choice(GENERIC_WRONG), rng.choice(GENERIC_WRONG)]
    # uniquify
    choices = [fact]
    for o in others:
        if o not in choices:
            choices.append(o)
    while len(choices) < 4:
        choices.append(rng.choice(GENERIC_WRONG) + " (" + str(len(choices)) + ")")
    choices = choices[:4]
    rng.shuffle(choices)
    return {
        "id": qid,
        "type": "mcq",
        "prompt": prompt,
        "choices": choices,
        "answer": choices.index(fact),
        "explain": f"Point clé de la section « {section_title[:60]} ».",
    }


def build_assessment(
    chapter: dict, kind: str, count: int, pass_score: float, rng: random.Random
) -> dict:
    paras = paragraphs(chapter)
    facts = pick_facts(paras, max(count + 4, 10))
    if len(facts) < 2:
        # fallback from titles
        facts = [
            s.get("title") or f"Point {i}"
            for i, s in enumerate(chapter.get("sections") or [], 1)
            if s.get("title") and s["title"] not in ("Introduction",)
        ][: count + 2]
        facts = [
            f"Le chapitre insiste sur : {t}." if not t.endswith(".") else t for t in facts
        ]

    questions = []
    i = 0
    # Mix question styles
    while len(questions) < count and i < 40:
        i += 1
        if not facts:
            break
        fact = facts[(len(questions) + i) % len(facts)]
        others = [f for f in facts if f != fact]
        style = len(questions) % 3
        if style == 0:
            q = make_mcq(f"{kind[0]}{len(questions)+1}", fact, others, rng)
        elif style == 1:
            q = make_scenario_q(f"{kind[0]}{len(questions)+1}", fact, rng)
            if not q:
                q = make_mcq(f"{kind[0]}{len(questions)+1}", fact, others, rng)
        else:
            # section-linked
            sec_title = "Point clé"
            for title, text in paras:
                if fact[:40] in text or text.startswith(fact[:40]):
                    sec_title = title or sec_title
                    break
            q = make_section_q(f"{kind[0]}{len(questions)+1}", sec_title, fact, rng)
        # avoid duplicate prompts+answers
        sig = (q["prompt"], q["answer"], tuple(q["choices"]))
        if any(
            (qq["prompt"], qq["answer"], tuple(qq["choices"])) == sig for qq in questions
        ):
            continue
        questions.append(q)

    # pad if needed with unique generic framed by chapter title
    title = chapter.get("title") or "ce chapitre"
    while len(questions) < count:
        n = len(questions) + 1
        correct = f"Le contenu de « {title[:70]} » doit être lu comme une mécanique de marché, pas comme une formule isolée."
        choices = [
            correct,
            "Il suffit d’une seule statistique pour trader ce chapitre.",
            "Les flux et la liquidité sont hors sujet ici.",
            "Le chapitre nie tout lien entre prix et rendement.",
        ]
        rng.shuffle(choices)
        questions.append(
            {
                "id": f"{kind[0]}{n}",
                "type": "mcq",
                "prompt": "Quel principe de lecture retenir pour ce chapitre ?",
                "choices": choices,
                "answer": choices.index(correct),
                "explain": "La Masterclass insiste sur les mécaniques, pas sur les raccourcis.",
            }
        )

    label = "Quiz d’entraînement" if kind == "quiz" else "Examen de validation des acquis"
    return {
        "title": label,
        "kind": kind,
        "passScore": pass_score,
        "passLabel": f"Seuil de réussite : {int(pass_score * 100)} %",
        "questions": questions[:count],
    }


def process_chapter(path: Path, rng: random.Random) -> dict:
    chapter = json.loads(path.read_text(encoding="utf-8"))
    # Quiz 3–5 selon richesse
    paras = paragraphs(chapter)
    n_quiz = 5 if len(paras) > 80 else 4 if len(paras) > 40 else 3
    n_exam = 5
    chapter["quiz"] = build_assessment(chapter, "quiz", n_quiz, 0.6, rng)
    chapter["exam"] = build_assessment(chapter, "exam", n_exam, 0.8, rng)
    # objectives light
    if not chapter.get("objectives"):
        titles = [
            s["title"]
            for s in (chapter.get("sections") or [])
            if s.get("title") and s["title"] != "Introduction"
        ][:4]
        chapter["objectives"] = titles
    path.write_text(json.dumps(chapter, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return chapter


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chapters", type=Path, default=Path("private/masterclass-content/chapters"))
    ap.add_argument("--seed-dir", type=Path, default=Path("deploy/vps/masterclass-seed"))
    ap.add_argument("--tarball", type=Path, default=None)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    rng = random.Random(args.seed)

    files = sorted(args.chapters.glob("*.json"))
    if not files:
        raise SystemExit(f"Aucun JSON dans {args.chapters}")

    index_chapters = []
    for p in files:
        ch = process_chapter(p, rng)
        nq = len(ch["quiz"]["questions"])
        ne = len(ch["exam"]["questions"])
        print(f"OK {p.name}: quiz={nq} exam={ne} — {ch.get('title', '')[:55]}")
        # sync seed chapters
        if args.seed_dir:
            out = args.seed_dir / "chapters"
            out.mkdir(parents=True, exist_ok=True)
            (out / p.name).write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
        index_chapters.append(
            {
                "id": ch["id"],
                "number": ch["number"],
                "title": ch["title"],
                "slug": ch.get("slug"),
                "status": ch.get("status") or "published",
                "sectionsCount": len(ch.get("sections") or []),
                "tablesCount": len(ch.get("tables") or []),
                "wordCount": ch.get("wordCount") or 0,
                "quizCount": nq,
                "examCount": ne,
            }
        )

    if args.seed_dir:
        idx = {
            "module": "masterclass-macro",
            "title": "Masterclass Macroéconomie & Marchés Financiers",
            "chapterCount": len(index_chapters),
            "chapters": index_chapters,
        }
        (args.seed_dir / "index.json").write_text(
            json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        (args.chapters.parent / "index.json").write_text(
            json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    if args.tarball:
        import tarfile

        args.tarball.parent.mkdir(parents=True, exist_ok=True)
        with tarfile.open(args.tarball, "w:gz") as tar:
            for p in sorted((args.seed_dir / "chapters").glob("*.json")):
                tar.add(p, arcname=f"chapters/{p.name}")
        print(f"Tarball → {args.tarball}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
