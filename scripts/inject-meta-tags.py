#!/usr/bin/env python3
"""
Injecte les balises meta SEO sur toutes les pages HTML TORINVEST.
Usage: python3 scripts/inject-meta-tags.py
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_URL = "https://www.torinvest-trading.com"
SITE_NAME = "TORINVEST"
OG_IMAGE = f"{SITE_URL}/forge-logo.png"

# Pages archives (redirigées + noindex)
ARCHIVE_PAGES = {"indexOLD.html", "index1.html", "index3.html", "indexx.html"}

# Pages privées / noindex
NOINDEX_PAGES = ARCHIVE_PAGES | {
    "AITORINVEST2.html",
    "dev-access.html",
    "activation.html",
    "activation-accompagnement.html",
}

META: dict[str, dict[str, str]] = {
    "index.html": {
        "description": "TORINVEST AI — infrastructure décisionnelle macro, smart money, IA, MT5 et intelligence de marché pour traders.",
        "keywords": "trading, macro, IA, MT5, smart money, TORINVEST, or, forex, crypto",
    },
    "indexOLD.html": {
        "description": "Archive — ancienne page d'accueil TORINVEST. Redirigée vers la page principale.",
    },
    "index1.html": {
        "description": "Archive — ancienne page d'accueil TORINVEST. Redirigée vers la page principale.",
    },
    "index3.html": {
        "description": "Archive — ancienne page d'accueil TORINVEST. Redirigée vers la page principale.",
    },
    "indexx.html": {
        "description": "Archive — ancienne page d'accueil TORINVEST. Redirigée vers la page principale.",
    },
    "AITORINVEST.html": {
        "description": "Terminal TORINVEST AI ACCESS — Command Center avec validation de licence.",
        "robots": "noindex, nofollow",
    },
    "AITORINVEST2.html": {
        "description": "Terminal TORINVEST AI Forge — accès développeur.",
        "robots": "noindex, nofollow",
    },
    "ai-access.html": {
        "description": "Connexion licence TORINVEST AI — validez votre abonnement pour accéder au terminal.",
        "robots": "noindex, nofollow",
    },
    "dev-access.html": {
        "description": "Accès développeur TORINVEST Forge.",
        "robots": "noindex, nofollow",
    },
    "accompagnement-access.html": {
        "description": "Accès accompagnement TORINVEST — validation de licence accompagnement.",
        "robots": "noindex, nofollow",
    },
    "activation.html": {
        "description": "Activation de licence TORINVEST.",
        "robots": "noindex, nofollow",
    },
    "activation-accompagnement.html": {
        "description": "Activation accompagnement TORINVEST.",
        "robots": "noindex, nofollow",
    },
    "actualites.html": {
        "description": "Actualités TORINVEST — news trading, macro, crypto et communauté.",
        "keywords": "actualités trading, news macro, TORINVEST",
    },
    "airdrop.html": {
        "description": "Airdrop Les Premiers Forgerons — programme communautaire TORINVEST.",
        "keywords": "airdrop, TORINVEST, forgerons, tokens",
    },
    "bootcamp.html": {
        "description": "Bootcamp TORINVEST — coaching trading et formation intensive.",
        "keywords": "bootcamp trading, coaching, TORINVEST",
    },
    "chronique1.html": {
        "description": "Chronique TORINVEST — Changement de régime et réallocation des élites (2008–2025).",
        "keywords": "macro, chronique, élites, TORINVEST",
    },
    "chronique2.html": {
        "description": "Chronique TORINVEST #2 — La Fed perd sa légitimité face à Trump.",
        "keywords": "Fed, Trump, macro, TORINVEST",
    },
    "chronique3.html": {
        "description": "Chronique TORINVEST #3 — La Grande Tokenisation (2024–2035).",
        "keywords": "tokenisation, macro, TORINVEST",
    },
    "chronique4.html": {
        "description": "Chronique TORINVEST — Monnaie et confiance dans les marchés.",
        "keywords": "monnaie, confiance, macro, TORINVEST",
    },
    "chronique5.html": {
        "description": "TORINVEST Trading — Outil d'analyse de la politique monétaire.",
        "keywords": "politique monétaire, trading, TORINVEST",
    },
    "chronique6.html": {
        "description": "Chronique TORINVEST — Détroits maritimes et routes commerciales.",
        "keywords": "géopolitique, commerce, TORINVEST",
    },
    "chroniques.html": {
        "description": "Chroniques TORINVEST — analyses macroéconomiques et géopolitiques.",
        "keywords": "chroniques, macro, TORINVEST",
    },
    "copytrading.html": {
        "description": "Copy Trading TORINVEST — disponible en 2026.",
        "keywords": "copy trading, TORINVEST",
    },
    "crypto.html": {
        "description": "Crypto TORINVEST — tokens KRM et ORAX, écosystème Solana et vision tokenisation.",
        "keywords": "crypto, KRM, ORAX, Solana, TORINVEST",
    },
    "crypto-blockchain.html": {
        "description": "Blockchain TORINVEST — Chainwork, minage et expérimentations Web3.",
        "keywords": "blockchain, minage, TORINVEST",
    },
    "dashboard-iron.html": {
        "description": "Dashboard Iron Fish — suivi minage TORINVEST.",
        "keywords": "Iron Fish, minage, dashboard, TORINVEST",
    },
    "disclaimer.html": {
        "description": "Disclaimer TORINVEST — avertissements légaux et limites de responsabilité.",
        "keywords": "disclaimer, risques, TORINVEST",
    },
    "equipe.html": {
        "description": "Équipe TORINVEST — qui construit l'écosystème trading et IA.",
        "keywords": "équipe, TORINVEST, communauté",
    },
    "exercices.html": {
        "description": "Exercices interactifs La Forge TorInvest — entraînement trading.",
        "keywords": "exercices, formation, trading, TORINVEST",
    },
    "factory-ia.html": {
        "description": "TORINVEST AI Builder — créez votre site web avec l'IA.",
        "keywords": "IA, site web, builder, TORINVEST",
    },
    "faq.html": {
        "description": "FAQ TORINVEST — questions sur le projet, tokens KRM & ORAX, trading et risques.",
        "keywords": "FAQ, aide, TORINVEST, tokens",
    },
    "forge-page.html": {
        "description": "La Forge TORINVEST — formation trading, modules et outils.",
        "keywords": "formation, forge, trading, TORINVEST",
    },
    "formation.html": {
        "description": "Formation TORINVEST — modules pédagogiques trading et macro.",
        "keywords": "formation trading, TORINVEST",
    },
    "formationprice.html": {
        "description": "Tarifs formation TORINVEST — La Forge et offres pédagogiques.",
        "keywords": "formation, tarifs, TORINVEST",
    },
    "histoire.html": {
        "description": "Histoire des marchés financiers — perspective TORINVEST.",
        "keywords": "histoire, marchés financiers, TORINVEST",
    },
    "indicateur.html": {
        "description": "Indicateur Macro Dashboard TORINVEST — outil d'analyse TradingView.",
        "keywords": "indicateur, TradingView, macro, TORINVEST",
    },
    "ironfish.html": {
        "description": "Iron Fish et minage TORINVEST — PoW, GPU et écosystème Chainwork.",
        "keywords": "Iron Fish, minage, PoW, TORINVEST",
    },
    "liens.html": {
        "description": "Liens utiles TORINVEST — ressources trading, macro et communauté.",
        "keywords": "liens, ressources, TORINVEST",
    },
    "merci.html": {
        "description": "Merci — inscription liste d'attente TORINVEST confirmée.",
        "robots": "noindex, nofollow",
    },
    "metaverse.html": {
        "description": "Metaverse Torinvest — ORAX World et expériences immersives.",
        "keywords": "metaverse, ORAX, TORINVEST",
    },
    "mindset.html": {
        "description": "Mindset TORINVEST — psychologie et discipline du trader.",
        "keywords": "mindset, psychologie trading, TORINVEST",
    },
    "minage.html": {
        "description": "Minage TORINVEST — Kaspa, Ergo, Flux et Iron Fish.",
        "keywords": "minage, crypto, TORINVEST",
    },
    "module-or-cycles.html": {
        "description": "Module gratuit TORINVEST — Cycles de l'Or.",
        "keywords": "or, cycles, formation gratuite, TORINVEST",
    },
    "nft.html": {
        "description": "NFT TORINVEST — collection officielle de la Forge.",
        "keywords": "NFT, TORINVEST, collection",
    },
    "partenaires.html": {
        "description": "Partenaires et courtiers TORINVEST — réseau et affiliations.",
        "keywords": "partenaires, courtiers, TORINVEST",
    },
    "portfolio.html": {
        "description": "Portfolio investisseur éducatif TORINVEST — suivi et analyse.",
        "keywords": "portfolio, investissement, TORINVEST",
    },
    "premium.html": {
        "description": "Espace Premium La Forge TorInvest — accès token-gated KRM et ORAX.",
        "keywords": "premium, KRM, ORAX, TORINVEST",
    },
    "projets.html": {
        "description": "Projets TORINVEST — KRM, ORAX, Chainwork et écosystème digital.",
        "keywords": "projets, tokens, TORINVEST",
    },
    "roadmap.html": {
        "description": "Roadmap TORINVEST — feuille de route, phases et vision long terme.",
        "keywords": "roadmap, vision, TORINVEST",
    },
    "robot-trading-torinvest.html": {
        "description": "Robot de trading TORINVEST — EA MT5 connecté à l'infrastructure IA.",
        "keywords": "robot trading, MT5, EA, TORINVEST",
    },
    "salle-des-marches.html": {
        "description": "Salle des Marchés TORINVEST — offre Forgeron et analyses live.",
        "keywords": "marchés, trading live, TORINVEST",
    },
    "tormission.html": {
        "description": "TorMission — programme Test & Earn pour tester l'indicateur Macro Vision.",
        "keywords": "TorMission, test, tokens, TORINVEST",
    },
    "tormission2.html": {
        "description": "TorMission #2 — Real Yield Gold Bias, programme communautaire Torinvest.",
        "keywords": "TorMission, or, indicateur, TORINVEST",
    },
    "torpass.html": {
        "description": "TorPass — accès Premium La Forge via wallet Solana (KRM & ORAX).",
        "keywords": "TorPass, Solana, premium, TORINVEST",
    },
    "tuto-mt5-robot-torinvest.html": {
        "description": "Tutoriel — connecter MT5 au robot TORINVEST.",
        "keywords": "MT5, tutoriel, robot, TORINVEST",
    },
    "video.html": {
        "description": "Vidéos TORINVEST — contenus YouTube et formations visuelles.",
        "keywords": "vidéos, YouTube, TORINVEST",
    },
    "whitepaper.html": {
        "description": "White Paper TORINVEST — vision, tokens KRM & ORAX et écosystème.",
        "keywords": "whitepaper, KRM, ORAX, TORINVEST",
    },
}

META_BLOCK_RE = re.compile(
    r"\n\s*<!-- TORINVEST META SEO -->.*?</script>\s*\n",
    re.DOTALL,
)


def extract_title(content: str) -> str:
    m = re.search(r"<title>([^<]+)</title>", content, re.IGNORECASE)
    return m.group(1).strip() if m else "TORINVEST"


def build_meta_block(filename: str, title: str) -> str:
    info = META.get(filename, {})
    description = info.get(
        "description",
        f"{title} — écosystème TORINVEST trading, macro et IA.",
    )
    keywords = info.get("keywords", "TORINVEST, trading, macro, IA")
    robots = info.get("robots")
    if not robots:
        robots = "noindex, nofollow" if filename in NOINDEX_PAGES else "index, follow"

    canonical = f"{SITE_URL}/{filename}"
    og_title = title

    return f"""
  <!-- TORINVEST META SEO -->
  <meta name="description" content="{description}" />
  <meta name="keywords" content="{keywords}" />
  <meta name="author" content="TORINVEST" />
  <meta name="robots" content="{robots}" />
  <link rel="canonical" href="{canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:site_name" content="{SITE_NAME}" />
  <meta property="og:title" content="{og_title}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:image" content="{OG_IMAGE}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{og_title}" />
  <meta name="twitter:description" content="{description}" />
  <meta name="twitter:image" content="{OG_IMAGE}" />
  <meta name="theme-color" content="#040407" />
  <link rel="icon" href="/forge-logo.png" type="image/png" />
  <script type="application/ld+json">
  {{"@context":"https://schema.org","@type":"WebPage","name":"{og_title}","description":"{description}","url":"{canonical}","inLanguage":"fr-FR","isPartOf":{{"@type":"WebSite","name":"{SITE_NAME}","url":"{SITE_URL}/"}}}}
  </script>
"""


def inject_into_file(path: Path) -> bool:
    content = path.read_text(encoding="utf-8")
    filename = path.name
    title = extract_title(content)

    # Retirer anciennes metas individuelles en doublon (description seulement si bloc pas encore injecté)
    if "<!-- TORINVEST META SEO -->" not in content:
        content = re.sub(
            r'\n\s*<meta name="description"[^>]*>\s*',
            "\n",
            content,
            count=1,
        )

    new_block = build_meta_block(filename, title)

    if META_BLOCK_RE.search(content):
        content = META_BLOCK_RE.sub("\n" + new_block, content)
    else:
        # Insérer après viewport ou charset ou title
        inserted = False
        for pattern in [
            r'(<meta name="viewport"[^>]*>)',
            r'(<meta charset="[^"]*"[^/]*/?>)',
            r'(<title>[^<]+</title>)',
        ]:
            m = re.search(pattern, content, re.IGNORECASE)
            if m:
                pos = m.end()
                content = content[:pos] + new_block + content[pos:]
                inserted = True
                break
        if not inserted:
            content = content.replace("<head>", "<head>" + new_block, 1)

    path.write_text(content, encoding="utf-8")
    return True


def main() -> None:
    html_files = sorted(ROOT.glob("*.html"))
    count = 0
    for path in html_files:
        inject_into_file(path)
        count += 1
        print(f"  ✓ {path.name}")
    print(f"\n{count} fichiers traités.")


if __name__ == "__main__":
    main()
