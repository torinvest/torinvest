/**
 * Fondamental — macro & fondamentaux marchés (~13 h)
 * Données alignées sur le build applifonda (61 cours · 775 min de lecture estimée).
 */
const FONDA_TITLE = "Fondamental";
const FONDA_SLOGAN = "Comprendre pourquoi les marchés bougent";
const FONDA_COURSE_COUNT = 61;
const FONDA_LEVEL_COUNT = 9;
const FONDA_TOTAL_MINUTES = 775;
const FONDA_TOTAL_HOURS = 13;

const FONDA_LEVELS = [
  {
    level: 1,
    title: "Les bases de l'économie",
    subtitle: "Offre, demande, inflation, croissance et cycles.",
    minutes: 96,
    hours: 1.5,
  },
  {
    level: 2,
    title: "L'argent et les banques",
    subtitle: "Histoire de la monnaie, fonctions, crédit, liquidité et banques.",
    minutes: 167,
    hours: 2.5,
  },
  {
    level: 3,
    title: "Banques centrales et taux",
    subtitle: "Fed, BCE, taux directeurs et politique monétaire.",
    minutes: 65,
    hours: 1,
  },
  {
    level: 4,
    title: "Les obligations",
    subtitle: "Prix, rendement, courbe des taux et crédit.",
    minutes: 57,
    hours: 1,
  },
  {
    level: 5,
    title: "Les marchés financiers",
    subtitle: "Actions, forex, matières premières et crypto.",
    minutes: 82,
    hours: 1.5,
  },
  {
    level: 6,
    title: "Macroéconomie",
    subtitle: "CPI, NFP, PMI et le calendrier qui fait bouger les prix.",
    minutes: 52,
    hours: 1,
  },
  {
    level: 7,
    title: "Comprendre les marchés",
    subtitle: "Risk on/off, priced-in, liquidité et intermarket.",
    minutes: 64,
    hours: 1,
  },
  {
    level: 8,
    title: "Les cycles",
    subtitle: "Expansion, récession, goldilocks, stagflation…",
    minutes: 56,
    hours: 1,
  },
  {
    level: 9,
    title: "Entreprises & Valorisation",
    subtitle: "Apprendre à lire une entreprise comme un investisseur.",
    minutes: 136,
    hours: 2,
  },
];

function getFondaHoursLabel() {
  return "~" + FONDA_TOTAL_HOURS + " h";
}

function getFondaMetaLabel() {
  return (
    FONDA_COURSE_COUNT +
    " cours · ~" +
    FONDA_TOTAL_HOURS +
    " h · " +
    FONDA_LEVEL_COUNT +
    " niveaux"
  );
}

window.FONDA_TITLE = FONDA_TITLE;
window.FONDA_SLOGAN = FONDA_SLOGAN;
window.FONDA_COURSE_COUNT = FONDA_COURSE_COUNT;
window.FONDA_LEVEL_COUNT = FONDA_LEVEL_COUNT;
window.FONDA_TOTAL_MINUTES = FONDA_TOTAL_MINUTES;
window.FONDA_TOTAL_HOURS = FONDA_TOTAL_HOURS;
window.FONDA_LEVELS = FONDA_LEVELS;
window.getFondaHoursLabel = getFondaHoursLabel;
window.getFondaMetaLabel = getFondaMetaLabel;
