/**
 * Mode d’emploi écosystème La Forge — étapes par rubrique.
 */
(function (global) {
  "use strict";

  var GUIDES = [
    {
      id: "tunnel",
      title: "Le tunnel (ordre recommandé)",
      accent: "gold",
      blurb: "Ne saute pas d’étape : chaque rubrique a un rôle précis.",
      steps: [
        "Connecte-toi (email Stripe + clé TOR) puis ouvre Premiers pas.",
        "Valide le Module 0, puis les lots de 3 modules Formation.",
        "Journalise chaque trade (ou revue) — c’est le feedback loop.",
        "Viens au live / Discord avec 1 question précise liée à un module.",
        "Utilise Crypto / Fondamental / Atlas en complément, pas en remplacement.",
      ],
      href: "/start.html",
      cta: "Premiers pas",
    },
    {
      id: "formation",
      title: "Formation trading",
      accent: "ember",
      blurb: "Parcours principal ICT/SMC — déblocage par lots de 3.",
      steps: [
        "Ouvre un module débloqué → lis les sections (barre de progression).",
        "Fais l’exercice chart TradingView (coche les tâches + screen).",
        "Coche la checklist de session (biais, invalidation, risque).",
        "Passe les exercices MCQ puis le quiz (seuil 70 %).",
        "Un module validé = sections + pratique + quiz OK → débloque le lot suivant.",
      ],
      href: "/course/index.html",
      cta: "Ouvrir Formation",
    },
    {
      id: "crypto",
      title: "Formation Crypto",
      accent: "teal",
      blurb: "24 modules · mêmes règles (lots de 3 + quiz).",
      steps: [
        "Commence par les bases (blockchain, BTC, ETH) avant les marchés.",
        "Sur C16 / Capstone : exercice chart crypto obligatoire avant le quiz.",
        "Relie chaque concept à un risque (custody, leverage, narrative).",
        "Ne trade pas un narratif sans checklist (taille, invalidation, sortie).",
      ],
      href: "/crypto/index.html",
      cta: "Ouvrir Crypto",
    },
    {
      id: "journal",
      title: "Trading Journal",
      accent: "mint",
      blurb: "Là où la théorie devient process.",
      steps: [
        "Crée un trade (symbole, side, setup, TF).",
        "Tague le module source (ex. module-09 ou c16-price-action).",
        "Ajoute 1–3 screens + notes.",
        "À la clôture : réponds aux 3 questions de revue guidée.",
        "Avant un live coaching : le coach voit tes 5 derniers trades.",
      ],
      href: "/journal.html",
      cta: "Ouvrir Journal",
    },
    {
      id: "calendrier",
      title: "Calendrier & Lives",
      accent: "blue",
      blurb: "1:1 coaching + lives collectifs + planning d’étude.",
      steps: [
        "Planifie tes modules sur le calendrier (étude personnelle).",
        "Confirme un créneau coaching 1:1 proposé par l’admin.",
        "Lis l’objectif pédagogique du live avant d’y aller.",
        "Lives collectifs : rappels mail + popup 4 h et 1 h avant.",
        "Après le live : ouvre le module lié et journalise 1 application.",
      ],
      href: "/calendar.html",
      cta: "Ouvrir Calendrier",
    },
    {
      id: "fondamental",
      title: "Fondamental",
      accent: "aqua",
      blurb: "Macro & contexte — Premium ou TorPass ACADEMY.",
      steps: [
        "Ouvre un cours court (~13 h au total).",
        "Note le biais macro du jour (taux, USD, liquidité).",
        "Croise avec Macro Edge (risk-on / risk-off) avant de trader XAU.",
      ],
      href: "/fondamental.html",
      cta: "Ouvrir Fondamental",
    },
    {
      id: "macro",
      title: "Macro Edge",
      accent: "bull",
      blurb: "Desk pédagogique — drivers USD/EUR/risk/policy.",
      steps: [
        "Lis le régime risk-on / risk-off du jour.",
        "Fais le mini-scénario (2 questions) sur la page.",
        "Applique sur f04 / mac01 (exercice chart Formation).",
        "Ce n’est pas un signal — c’est un cadre de lecture.",
      ],
      href: "/macro-edge.html",
      cta: "Ouvrir Macro Edge",
    },
    {
      id: "atlas",
      title: "Atlas (ICT · Styles · Psycho · Indicateurs · USA War)",
      accent: "cyan",
      blurb: "Ressources complémentaires — ne valident pas les modules.",
      steps: [
        "Atlas ICT : liquidité, FVG, OB, sessions — schémas annotés.",
        "Fais le quiz 3 Q en bas de fiche pour ancrer.",
        "Styles / Psycho / Indicateurs : culture de marché & mindset.",
        "USA War Atlas : géopolitique sourcée pour le contexte.",
        "Reviens à la Formation pour valider un module.",
      ],
      href: "/ict-atlas.html",
      cta: "Atlas ICT",
    },
    {
      id: "swing",
      title: "Analyses swing",
      accent: "sky",
      blurb: "Scénarios publiés — reproduis, ne copie pas à l’aveugle.",
      steps: [
        "Lis contexte + structure + scénarios base/bull/bear.",
        "Clique « Reproduire ce scénario » : checklist + upload screen.",
        "Compare ta lecture à l’analyse (pas de FOMO sur le niveau).",
      ],
      href: "/swing-analyses.html",
      cta: "Ouvrir Swing",
    },
    {
      id: "ressources",
      title: "Ressources live & Livres",
      accent: "sand",
      blurb: "Packs post-live + bibliothèque PDF Premium.",
      steps: [
        "Ressources : packs liés à un module (filtre / chapitre).",
        "Livres : ouvre 1 chapitre lié à ton module en cours.",
        "Objectif : 1 idée → 1 application journal.",
      ],
      href: "/resources.html",
      cta: "Ressources",
    },
  ];

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderEcosystemGuide(root) {
    if (!root) return;
    root.innerHTML =
      '<div class="eco-guide">' +
      '<header class="eco-guide-head">' +
      '<span class="forge-hero-tag">Mode d’emploi</span>' +
      "<h2>Comment utiliser l’écosystème La Forge</h2>" +
      '<p>Chaque rubrique a un job. Suis les étapes — ne consomme pas tout en même temps.</p>' +
      "</header>" +
      '<div class="eco-guide-grid">' +
      GUIDES.map(function (g, idx) {
        return (
          '<details class="eco-guide-card" data-accent="' +
          esc(g.accent) +
          '"' +
          (idx === 0 ? " open" : "") +
          ">" +
          "<summary>" +
          "<strong>" +
          esc(g.title) +
          "</strong>" +
          "<span>" +
          esc(g.blurb) +
          "</span>" +
          "</summary>" +
          "<ol>" +
          (g.steps || [])
            .map(function (s) {
              return "<li>" + esc(s) + "</li>";
            })
            .join("") +
          "</ol>" +
          (g.href
            ? '<p class="eco-guide-cta"><a class="btn btn-secondary btn-sm" href="' +
              esc(g.href) +
              '">' +
              esc(g.cta || "Ouvrir") +
              "</a></p>"
            : "") +
          "</details>"
        );
      }).join("") +
      "</div></div>";
  }

  global.ForgeEcosystemGuide = {
    GUIDES: GUIDES,
    render: renderEcosystemGuide,
  };
})(typeof window !== "undefined" ? window : global);
