/**
 * La Forge ICT-SMC-PRICE ACTION — ÉLITE (~57 h)
 * torinvest-trading.com — La force d'un esprit libre
 */
const FORGE_TITLE = "La Forge ICT-SMC-PRICE ACTION — ÉLITE";
const FORGE_SLOGAN = "La force d'un esprit libre";
const FORGE_TOTAL_HOURS = 57;
const FORGE_SITE = "torinvest-trading.com";

const COURSE_PARTS = [
  {
    id: "intro",
    title: "Partie 0 — Introduction",
    week: "Avant de commencer",
    hours: 1.5,
    blurb: "Le métier de trader, les mensonges des influenceurs, attentes réalistes.",
  },
  {
    id: "fondamentaux",
    title: "Partie I — Fondamentaux & marchés",
    week: "Semaines 1–2",
    hours: 7.5,
    blurb: "Microstructure, classes d'actifs, corrélations, XAUUSD, multi-timeframe et price action pur.",
  },
  {
    id: "macro",
    title: "Partie II — Macro & politique monétaire",
    week: "Semaines 3–4",
    hours: 6,
    blurb: "Drivers macro, DXY/taux, calendrier, banques centrales et politiques monétaires.",
  },
  {
    id: "structure",
    title: "Partie III — Structure ICT/SMC & liquidité",
    week: "Semaines 5–6",
    hours: 4.5,
    blurb: "Dealing range, MSS/BOS, pools, sweeps, manipulation — replays ÉLITE pas à pas.",
  },
  {
    id: "inefficiency",
    title: "Partie IV — Inefficience & arrays de prix",
    week: "Semaines 7–8",
    hours: 4.5,
    blurb: "FVG, order blocks, premium/discount, OTE, nested HTF/LTF.",
  },
  {
    id: "execution",
    title: "Partie V — Timing & modèles d'exécution",
    week: "Semaines 9–10",
    hours: 4.5,
    blurb: "Killzones, AMD, SMT, gaps, modèles 2022/Unicorn/Turtle Soup.",
  },
  {
    id: "elite",
    title: "Partie VI — Concepts ICT ÉLITE",
    week: "Semaines 11–12",
    hours: 4.5,
    blurb: "IRB, IPDA, séquences mitigation, consolidation du puzzle complet.",
  },
  {
    id: "infra",
    title: "Partie VII — Infrastructure & indicateurs",
    week: "Semaine 13",
    hours: 3,
    blurb: "Courtiers, spreads, plateformes MT5/Ninja/ATAS, prop firms, RSI/VWAP/delta/MACD.",
  },
  {
    id: "markets",
    title: "Partie VIII — Marchés élargis",
    week: "Semaine 14",
    hours: 3,
    blurb: "Bourse actions, diversification, marchés crypto.",
  },
  {
    id: "performance",
    title: "Partie IX — Performance & discipline",
    week: "Semaine 15",
    hours: 3,
    blurb: "Data, journal de trading, mindset professionnel.",
  },
  {
    id: "pro",
    title: "Partie X — Trading professionnel avancé",
    week: "Semaines 16–18",
    hours: 15,
    blurb: "Fiscalité, conformité AMF, instruments, options, news pro, drawdown, backtesting, scaling, sessions EU, tilt protocol.",
  },
];

const MODULES = [
  { id: "intro", part: "intro", href: "https://app.torinvest-trading.com/course/intro-metier.html", num: "0", title: "Le métier de trader & la vérité du marché", desc: "Réalités du trading · pièges influenceurs · attentes · ~90 min", minutes: 90, elite: false },
  { id: "f01", part: "fondamentaux", href: "https://app.torinvest-trading.com/course/f01-marches.html", num: "F1", title: "Participants & microstructure", desc: "Makers/takers · order flow · sweeps · ~90 min", minutes: 90, elite: false },
  { id: "f02", part: "fondamentaux", href: "https://app.torinvest-trading.com/course/f02-xauusd.html", num: "F2", title: "XAUUSD — anatomie de l'or", desc: "Sessions · volatilité · corrélations · ~90 min", minutes: 90, elite: false },
  { id: "f03", part: "fondamentaux", href: "https://app.torinvest-trading.com/course/f03-timeframes.html", num: "F3", title: "Multi-timeframe & narrative", desc: "HTF→LTF · fractal · journal · ~90 min", minutes: 90, elite: false },
  { id: "f04", part: "fondamentaux", href: "https://app.torinvest-trading.com/course/f04-actifs-marches.html", num: "F4", title: "Classes d'actifs & corrélations", desc: "FX · indices · or · taux · matrice intermarket · ~90 min", minutes: 90, elite: true },
  { id: "f05", part: "fondamentaux", href: "https://app.torinvest-trading.com/course/f05-price-action.html", num: "F5", title: "Price Action pur", desc: "Chandeliers · S/R · supply/demand · sans indicateur · ~90 min", minutes: 90, elite: true },
  { id: "mac01", part: "macro", href: "https://app.torinvest-trading.com/course/mac01-drivers.html", num: "M1", title: "Drivers macro de l'or", desc: "Real yields · risk-on/off · ~90 min", minutes: 90, elite: false },
  { id: "mac02", part: "macro", href: "https://app.torinvest-trading.com/course/mac02-intermarket.html", num: "M2", title: "Intermarket DXY & taux", desc: "DXY · US10Y · corrélations · ~90 min", minutes: 90, elite: false },
  { id: "mac03", part: "macro", href: "https://app.torinvest-trading.com/course/mac03-calendrier.html", num: "M3", title: "Calendrier & plan macro", desc: "NFP · FOMC · CPI · narrative · ~90 min", minutes: 90, elite: false },
  { id: "mac04", part: "macro", href: "https://app.torinvest-trading.com/course/mac04-banques-centrales.html", num: "M4", title: "Banques centrales & politique monétaire", desc: "Fed · BCE · taux directeurs · QE/QT · ~90 min", minutes: 90, elite: true },
  { id: "module-01", part: "structure", href: "https://app.torinvest-trading.com/course/module-01-structure.html", num: "1", title: "Market Structure & MSS", desc: "Dealing range · BOS · MSS · replay ÉLITE · ~90 min", minutes: 90, elite: true },
  { id: "module-02", part: "structure", href: "https://app.torinvest-trading.com/course/module-02-liquidity.html", num: "2", title: "Liquidité institutionnelle", desc: "ERL/IRL · SFP · Judas · ~90 min", minutes: 90, elite: true },
  { id: "module-03", part: "inefficiency", href: "https://app.torinvest-trading.com/course/module-03-fvg.html", num: "3", title: "FVG & inefficience", desc: "BISI/SIBI · IFVG · CE · ~90 min", minutes: 90, elite: true },
  { id: "module-04", part: "inefficiency", href: "https://app.torinvest-trading.com/course/module-04-order-blocks.html", num: "4", title: "Order Blocks avancés", desc: "OB · breaker · propulsion · ~90 min", minutes: 90, elite: true },
  { id: "module-05", part: "inefficiency", href: "https://app.torinvest-trading.com/course/module-05-premium-discount.html", num: "5", title: "Dealing Range & OTE", desc: "Premium/discount · OTE · nested · ~90 min", minutes: 90, elite: true },
  { id: "module-06", part: "execution", href: "https://app.torinvest-trading.com/course/module-06-killzones.html", num: "6", title: "Killzones & plan journalier", desc: "CBDR · AMD · Silver Bullet · ~90 min", minutes: 90, elite: true },
  { id: "module-07", part: "execution", href: "https://app.torinvest-trading.com/course/module-07-smt.html", num: "7", title: "SMT & intermarket", desc: "Divergences · validation · ~90 min", minutes: 90, elite: true },
  { id: "module-08", part: "execution", href: "https://app.torinvest-trading.com/course/module-08-gaps.html", num: "8", title: "NWOG, NDOG & profils weekly", desc: "Gaps · C.E. · magnet · ~90 min", minutes: 90, elite: true },
  { id: "module-09", part: "execution", href: "https://app.torinvest-trading.com/course/module-09-models.html", num: "9", title: "Modèles d'entrée avancés", desc: "2022 · Unicorn · Turtle Soup · ~90 min", minutes: 90, elite: true },
  { id: "module-10", part: "elite", href: "https://app.torinvest-trading.com/course/module-10-ict-elite.html", num: "10", title: "ICT ÉLITE — IRB, IPDA & séquences", desc: "IRB · IPDA · mitigation chain · ~90 min", minutes: 90, elite: true },
  { id: "module-11", part: "elite", href: "https://app.torinvest-trading.com/course/module-11-maitrise.html", num: "11", title: "Maîtrise — puzzle complet XAU", desc: "Cas intégré · forward test · journal ÉLITE · ~90 min", minutes: 90, elite: true },
  { id: "tool-courtiers", part: "infra", href: "https://app.torinvest-trading.com/course/tool-courtiers.html", num: "T1", title: "Courtiers, spreads & plateformes", desc: "MT5 · NinjaTrader · ATAS · prop firms · ~90 min", minutes: 90, elite: false },
  { id: "tool-indicateurs", part: "infra", href: "https://app.torinvest-trading.com/course/tool-indicateurs.html", num: "T2", title: "Indicateurs & order flow", desc: "RSI · VWAP · delta · MACD · stoch · momentum · ~90 min", minutes: 90, elite: false },
  { id: "divers-bourse", part: "markets", href: "https://app.torinvest-trading.com/course/divers-bourse.html", num: "B1", title: "Bourse & diversification", desc: "Actions · indices · ETF · corrélation portefeuille · ~90 min", minutes: 90, elite: false },
  { id: "divers-crypto", part: "markets", href: "https://app.torinvest-trading.com/course/divers-crypto.html", num: "B2", title: "Marchés crypto", desc: "BTC · ETH · cycles · corrélation risk-on · ~90 min", minutes: 90, elite: false },
  { id: "data-journal", part: "performance", href: "https://app.torinvest-trading.com/course/data-journal.html", num: "P1", title: "Data & journal de trading", desc: "Métriques · conception journal · critères utiles · ~90 min", minutes: 90, elite: true },
  { id: "mindset", part: "performance", href: "https://app.torinvest-trading.com/course/mindset.html", num: "P2", title: "Mindset & discipline pro", desc: "Psychologie · process · gestion émotion · ~90 min", minutes: 90, elite: false },
  { id: "pro-fiscalite", part: "pro", href: "https://app.torinvest-trading.com/course/pro-fiscalite.html", num: "L1", title: "Fiscalité trading — France, Belgique, Suisse", desc: "Plus-values · statuts · déclarations · ~90 min", minutes: 90, elite: true },
  { id: "pro-regulation", part: "pro", href: "https://app.torinvest-trading.com/course/pro-regulation.html", num: "L2", title: "Réglementation, AMF et arnaques", desc: "Clone firms · brokers · protection capital · ~90 min", minutes: 90, elite: true },
  { id: "pro-instruments", part: "pro", href: "https://app.torinvest-trading.com/course/pro-instruments.html", num: "T3", title: "Futures vs CFD vs spot", desc: "Coûts réels · rollover · micro contrats · ~90 min", minutes: 90, elite: true },
  { id: "pro-options", part: "pro", href: "https://app.torinvest-trading.com/course/pro-options.html", num: "B3", title: "Options et hedging portefeuille", desc: "Puts · collars · protection or/actions · ~90 min", minutes: 90, elite: false },
  { id: "pro-news", part: "pro", href: "https://app.torinvest-trading.com/course/pro-news.html", num: "M5", title: "News trading avancé", desc: "Slippage · no-trade zones · CPI/FOMC/NFP · ~90 min", minutes: 90, elite: true },
  { id: "pro-drawdown", part: "pro", href: "https://app.torinvest-trading.com/course/pro-drawdown.html", num: "P3", title: "Drawdown, Kelly et ruine", desc: "Séries perdantes · recovery · taille position · ~90 min", minutes: 90, elite: true },
  { id: "pro-backtesting", part: "pro", href: "https://app.torinvest-trading.com/course/pro-backtesting.html", num: "P4", title: "Backtesting rigoureux & Monte Carlo", desc: "Walk-forward · overfitting · validation edge · ~90 min", minutes: 90, elite: true },
  { id: "pro-scaling", part: "pro", href: "https://app.torinvest-trading.com/course/pro-scaling.html", num: "P5", title: "Multi-comptes et scaling", desc: "Prop · personnel · allocation · corrélation · ~90 min", minutes: 90, elite: true },
  { id: "pro-asie", part: "pro", href: "https://app.torinvest-trading.com/course/pro-asie.html", num: "F6", title: "Session Asie pour traders EU", desc: "Sommeil · fatigue · discipline horaire · ~90 min", minutes: 90, elite: false },
  { id: "pro-tilt", part: "pro", href: "https://app.torinvest-trading.com/course/pro-tilt.html", num: "P6", title: "Tilt protocol — psychologie avancée", desc: "Protocole 2 pertes · escalation · graduation pro · ~90 min", minutes: 90, elite: true },
];

function getAllModuleIds() {
  return MODULES.map((m) => m.id);
}

function getModuleById(id) {
  return MODULES.find((m) => m.id === id);
}

function getPartById(id) {
  return COURSE_PARTS.find((p) => p.id === id);
}

function getModuleCount() {
  return MODULES.length;
}

window.FORGE_TITLE = FORGE_TITLE;
window.FORGE_SLOGAN = FORGE_SLOGAN;
window.FORGE_TOTAL_HOURS = FORGE_TOTAL_HOURS;
window.FORGE_SITE = FORGE_SITE;
window.COURSE_PARTS = COURSE_PARTS;
window.MODULES = MODULES;
window.getAllModuleIds = getAllModuleIds;
window.getModuleById = getModuleById;
window.getPartById = getPartById;
window.getModuleCount = getModuleCount;
