/**
 * Guides "Comment utiliser ce module" — contenu pédagogique par module.
 * Fallback générique si pas d'override spécifique.
 */
(function (global) {
  "use strict";

  var DEFAULT_ORDER = [
    "Lire le mode d'emploi (cet onglet) pour comprendre l'objectif et l'ordre.",
    "Regarder la / les vidéos du module si présentes.",
    "Parcourir les sections dans l'ordre (boutons numérotés).",
    "Faire l'exercice pratique / le chart replay s'il y en a.",
    "Passer le quiz (seuil 70 %) pour valider le module.",
    "Noter tes questions dans l'onglet « Mes questions » — le coach te répond.",
  ];

  /** Overrides optionnels par moduleId */
  var GUIDES = {
    intro: {
      goal: "Poser le cadre du métier, les attentes réalistes, et le contrat pédagogique TORINVEST avant toute technique.",
      order: [
        "Lis ce mode d'emploi.",
        "Regarde les vidéos du Module 0 (métier / vérité du marché).",
        "Parcours les 12 sections dans l'ordre.",
        "Fais le quiz (≥ 70 %) pour valider.",
        "Pose tes questions mindset / attentes dans « Mes questions ».",
      ],
      tips: [
        "Ne saute pas ce module : il filtre les attentes « gains rapides ».",
        "Le parcours guidé (lots de 3) est une feature, pas une punition.",
      ],
    },
    f01: {
      goal: "Comprendre qui fait bouger le marché (makers/takers, order flow) avant de lire le prix.",
      tips: [
        "Relie chaque notion à une observation concrète sur XAUUSD.",
        "Si un terme est flou, pose la question dans l'onglet dédié.",
      ],
    },
    f02: {
      goal: "Maîtriser l'anatomie de l'or (sessions, volatilité, corrélations) comme terrain de jeu principal.",
    },
    "module-01": {
      goal: "Lire la structure de marché (BOS / MSS) et la logique institutionnelle sur chart.",
      tips: [
        "Utilise le replay ÉLITE section par section.",
        "Valide le quiz avant de passer à la liquidité.",
      ],
    },
  };

  function moduleMeta(moduleId) {
    var list = global.MODULES || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === moduleId) return list[i];
    }
    return null;
  }

  function getModuleGuide(moduleId) {
    var meta = moduleMeta(moduleId);
    var override = GUIDES[moduleId] || {};
    var title = meta ? meta.title : moduleId || "Module";
    var num = meta ? meta.num : "";
    var minutes = meta && meta.minutes ? meta.minutes : 90;

    return {
      moduleId: moduleId,
      title: title,
      num: num,
      minutes: minutes,
      goal:
        override.goal ||
        "Comprendre et appliquer les concepts de « " +
          title +
          " », puis valider par le quiz et la pratique.",
      order: override.order || DEFAULT_ORDER.slice(),
      tips: override.tips || [
        "Reste dans l'ordre des sections : chaque brique prépare la suivante.",
        "Le quiz à 70 % débloque la progression (lots de 3 modules).",
        "Toute question (même hors sujet du module) peut aller dans « Mes questions ».",
      ],
      validation: [
        "Parcourir les sections du module",
        "Quiz ≥ 70 %",
        "Exercice pratique ≥ 70 % (si présent)",
      ],
    };
  }

  global.getModuleGuide = getModuleGuide;
  global.FORGE_MODULE_GUIDES = GUIDES;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
