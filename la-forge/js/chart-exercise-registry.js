/**
 * Registre exercices chart — un config par module
 */
const CHART_EXERCISE_REGISTRY = {
  intro: {
    intro: "Feuille ou Notion — réflexion pré-formation.",
    tasks: [
      { title: "Croyances à abandonner", desc: "Listez 3 idées reçues des influenceurs (Lamborghini, 90% win rate…)." },
      { title: "Votre process actuel", desc: "5 étapes de votre méthode aujourd'hui — honnête." },
      { title: "Critères demo→live", desc: "50 trades, PF, DD max — seuils écrits." },
      { title: "Engagement", desc: "Une phrase : je trade le process, pas l'ego." },
    ],
  },
  f01: {
    intro: "XAUUSD ou EURUSD M15 — une session récente.",
    chartHint: "Marquez les sessions et un sweep visible.",
    tasks: [
      { title: "Sessions", desc: "Asian / London / NY sur le chart." },
      { title: "Sweep", desc: "Mèche prenant un pool de liquidité." },
      { title: "Order flow", desc: "Corps confirme ou rejette le sweep ?" },
      { title: "Journal", desc: "3 lignes : piège retail, liquidité, réaction." },
    ],
  },
  f02: {
    intro: "XAUUSD M15 · comparez Asian vs London vs NY.",
    tasks: [
      { title: "Asian H/L", desc: "Tracez high et low de la session Asian." },
      { title: "London sweep", desc: "Marquez sweep SSL ou BSL Asian." },
      { title: "DXY overlay", desc: "Corrélation inverse visible sur H1 ?" },
      { title: "Spread", desc: "Notez spread à l'entrée vs après news." },
    ],
  },
  f03: {
    intro: "XAUUSD H4 + M15 alignés.",
    tasks: [
      { title: "Range H4", desc: "RH, RL, EQ tracés." },
      { title: "Structure M15", desc: "BOS ou MSS aligné HTF." },
      { title: "Narrative", desc: "1 phrase biais HTF + setup LTF." },
      { title: "Capture", desc: "Screenshot H4 + M15 annotés." },
    ],
  },
  f04: {
    intro: "XAU + DXY + US10Y — même fenêtre temporelle.",
    tasks: [
      { title: "Régime", desc: "Risk-on ou risk-off du jour." },
      { title: "Matrice", desc: "DXY vs XAU — corrélation ou cassure ?" },
      { title: "Anomalie", desc: "Notez si corrélation habituelle est cassée." },
      { title: "Biais", desc: "Long / short / flat XAU justifié." },
    ],
  },
  f05: {
    intro: "Chart nu — aucun indicateur.",
    tasks: [
      { title: "Supply/Demand", desc: "2 zones supply, 2 demand." },
      { title: "Trend", desc: "HH/HL ou LH/LL sur 20 bougies." },
      { title: "Wick rejection", desc: "1 mèche de rejet significative." },
      { title: "Pont ICT", desc: "Où FVG/OB pourrait apparaître." },
    ],
  },
  mac01: { intro: "XAU D1 + US10Y.", tasks: [{ title: "Real yields", desc: "Direction taux 5 jours." }, { title: "Risk regime", desc: "Risk-on/off sur chart." }, { title: "Catalyseur", desc: "News récente." }, { title: "Biais or", desc: "Phrase biais hebdo." }] },
  mac02: { intro: "DXY H4 + XAU H4.", tasks: [{ title: "Corrélation", desc: "3 swings inverse XAU/DXY." }, { title: "Divergence", desc: "SMT intermarket si visible." }, { title: "Niveaux", desc: "RH/RL DXY marqués." }, { title: "Journal", desc: "Colonne intermarket remplie." }] },
  mac03: { intro: "Jour avec news rouge.", tasks: [{ title: "Calendrier", desc: "3 events + heures." }, { title: "Killzone", desc: "Fenêtre autour des news." }, { title: "Post-news", desc: "Displacement 15 min après." }, { title: "Plan", desc: "Trade ou flat — écrit." }] },
  mac04: { intro: "Contexte Fed/BCE + XAU D1.", tasks: [{ title: "Dernière Fed/BCE", desc: "Hawkish ou dovish ?" }, { title: "Taux", desc: "Impact sur XAU." }, { title: "QE/QT", desc: "Liquidité système." }, { title: "Narrative", desc: "BC + conséquence or." }] },
  "module-01": {
    intro: "XAUUSD M15 London — cas MSS bearish du replay.",
    tasks: [
      { title: "Range H4", desc: "RH/RL/EQ — premium identifié." },
      { title: "Sweep SSL", desc: "Bougie sweep — pas d'entrée sur sweep." },
      { title: "MSS", desc: "Clôture sous dernier HL." },
      { title: "Trade", desc: "OB short, SL au-dessus sweep, TP SSL/RL dessous." },
    ],
  },
  "module-02": { intro: "XAU M15 — liquidité.", tasks: [{ title: "ERL/IRL", desc: "Pools externes/internes." }, { title: "Sweep", desc: "SFP récent." }, { title: "Judas", desc: "Faux move session." }, { title: "TP", desc: "Pool opposé." }] },
  "module-03": { intro: "XAU M15 — FVG.", tasks: [{ title: "FVG", desc: "2 rectangles FVG." }, { title: "CE", desc: "50% du FVG récent." }, { title: "IFVG", desc: "FVG comblé si présent." }, { title: "Plan entrée", desc: "CE ou rejection." }] },
  "module-04": { intro: "XAU M15 — OB.", tasks: [{ title: "OB", desc: "Dernier OB valide." }, { title: "Breaker", desc: "OB cassé si visible." }, { title: "Retest", desc: "Mitigation notée." }, { title: "SL", desc: "Sous/au-dessus swing." }] },
  "module-05": { intro: "H4 + M15 — PD.", tasks: [{ title: "Range H4", desc: "RH/RL/EQ." }, { title: "PD", desc: "Premium ou discount %." }, { title: "OTE", desc: "Zone 62–79%." }, { title: "Alignement", desc: "Setup bon quartile ?" }] },
  "module-06": { intro: "XAU M15 — killzones.", tasks: [{ title: "CBDR", desc: "Range CBDR." }, { title: "Asian", desc: "H/L Asian." }, { title: "London/NY", desc: "Fenêtres colorées." }, { title: "AMD", desc: "Phase A/M/D du jour." }] },
  "module-07": { intro: "XAU + DXY M15.", tasks: [{ title: "2 charts", desc: "Même TF, même période." }, { title: "SMT", desc: "Divergence swing." }, { title: "Validation", desc: "Confirme biais ?" }, { title: "Capture", desc: "Screenshot annoté." }] },
  "module-08": { intro: "XAU weekly + M15.", tasks: [{ title: "NWOG/NDOG", desc: "Lignes gap." }, { title: "C.E.", desc: "Centre gap." }, { title: "Magnet", desc: "Prix vers gap ?" }, { title: "Plan", desc: "Gap S/R ou cible." }] },
  "module-09": { intro: "XAU M15 London — 2022/Unicorn.", tasks: [{ title: "Sweep", desc: "Pool pris." }, { title: "MSS", desc: "Shift confirmé." }, { title: "Entrée", desc: "FVG/OB overlap." }, { title: "RR", desc: "R:R ≥ 1:2 écrit." }] },
  "module-10": { intro: "XAU H4 + M15 — ÉLITE.", tasks: [{ title: "IRB", desc: "Barre référence." }, { title: "IPDA", desc: "ERL 20/40j." }, { title: "Mitig ①", desc: "1re zone." }, { title: "Chain", desc: "OB→FVG→entrée." }] },
  "module-11": { intro: "Cas intégré graduation.", tasks: [{ title: "Journal 4 col.", desc: "Macro/structure/élite/exécution." }, { title: "Replay", desc: "Frame par frame." }, { title: "Checklist", desc: "Piliers mobilisés." }, { title: "Forward test", desc: "Plan 50 demos." }] },
  "tool-courtiers": { intro: "Votre plateforme.", tasks: [{ title: "Spread", desc: "XAU London vs Asian." }, { title: "Commission", desc: "Coût A/R." }, { title: "Slippage", desc: "Limite vs market." }, { title: "Prop rules", desc: "3 règles prop firm." }] },
  "tool-indicateurs": { intro: "Chart nu + 1 indicateur à la fois.", tasks: [{ title: "RSI", desc: "Vs structure MSS." }, { title: "VWAP", desc: "Prix vs VWAP session." }, { title: "MACD", desc: "Divergence vs prix." }, { title: "Verdict", desc: "Confirme PA ?" }] },
  "divers-bourse": { intro: "SPX ou CAC40 H4.", tasks: [{ title: "Secteur", desc: "Leader du move." }, { title: "Corrélation XAU", desc: "Risk-on/off ?" }, { title: "Diversification", desc: "2 actifs décorrélés." }, { title: "Allocation", desc: "% XAU vs indices." }] },
  "divers-crypto": { intro: "BTC H4 + XAU H4.", tasks: [{ title: "Cycle BTC", desc: "Phase marché." }, { title: "Corrélation", desc: "BTC vs XAU." }, { title: "Volatilité", desc: "Range % comparé." }, { title: "24/7", desc: "Impact sessions." }] },
  "data-journal": { intro: "Conception journal.", tasks: [{ title: "Champs utiles", desc: "8 champs obligatoires." }, { title: "Champs inutiles", desc: "3 à supprimer." }, { title: "Template", desc: "1 trade fictif complet." }, { title: "Revue", desc: "Stats hebdo à lire." }] },
  mindset: { intro: "Réflexion post-session.", tasks: [{ title: "Émotion", desc: "FOMO/revenge/ok ?" }, { title: "Règles", desc: "3 règles non négociables." }, { title: "Erreur", desc: "1 erreur + correctif." }, { title: "Process", desc: "Score /10 discipline." }] },
  "pro-fiscalite": { intro: "Document fiscal personnel.", tasks: [{ title: "Pays résidence", desc: "FR / BE / CH + statut actuel." }, { title: "Registre", desc: "8 champs trades à conserver." }, { title: "Provision impôt", desc: "% mensuel gains vers compte impôt." }, { title: "Expectancy net", desc: "Brut − impôt − coûts sur 20 trades." }] },
  "pro-regulation": { intro: "Vérification broker.", tasks: [{ title: "Licence", desc: "Numéro sur site régulateur officiel." }, { title: "Liste noire", desc: "Recherche AMF/FCA nom entité." }, { title: "Retrait test", desc: "Plan retrait 50–100 € avant gros dépôt." }, { title: "Contrat", desc: "Entité légale = entité régulée ?" }] },
  "pro-instruments": { intro: "Tableau comparatif perso.", tasks: [{ title: "CFD coût", desc: "Spread + swap 30 j simulé." }, { title: "Futures", desc: "Commission + tick MGC/GC." }, { title: "Choix", desc: "Instrument principal 12 mois." }, { title: "Journal", desc: "Colonne coût instrument." }] },
  "pro-options": { intro: "Scénario hedge swing.", tasks: [{ title: "Exposition", desc: "Quantifier GLD/XAU/SPY exposé." }, { title: "Event risk", desc: "FOMC/CPI prochain — hedge ou reduce ?" }, { title: "Coût put", desc: "Premium % vs reduce size 30 %." }, { title: "Décision", desc: "Hedge ou reduce — une phrase." }] },
  "pro-news": { intro: "Semaine news rouges.", tasks: [{ title: "Calendrier", desc: "3 events + no-trade fenêtres." }, { title: "Spread log", desc: "Spread normal vs spread news historique." }, { title: "Protocole", desc: "Règle post-news structure écrite." }, { title: "Prop rules", desc: "News interdites prop ? copier extrait." }] },
  "pro-drawdown": { intro: "Simulateur equity.", tasks: [{ title: "DD max", desc: "Définir % max mensuel perso." }, { title: "Recovery table", desc: "-5/-10/-20 % → gain requis." }, { title: "Half size rule", desc: "Seuil activation écrit." }, { title: "Kelly", desc: "Calcul half-Kelly journal demo." }] },
  "pro-backtesting": { intro: "Replay 50 trades un setup.", tasks: [{ title: "Setup isolé", desc: "Un modèle — ex. 2022 London." }, { title: "OOS", desc: "20 trades période différente." }, { title: "Monte Carlo", desc: "1000 shuffle → DD 95e percentile." }, { title: "Règles max 5", desc: "Lister règles sans overfit." }] },
  "pro-scaling": { intro: "Architecture comptes.", tasks: [{ title: "Ladder", desc: "Demo → micro live → scale steps." }, { title: "Aggregation", desc: "Table tous comptes risk total." }, { title: "Payout split", desc: "50/30/20 ou votre règle." }, { title: "+0,25% rule", desc: "Critères augmenter taille." }] },
  "pro-asie": { intro: "Planning hebdo EU.", tasks: [{ title: "Horaires", desc: "Blocs London/NY/analyse écrits." }, { title: "Sommeil", desc: "Heure coucher/réveil cible." }, { title: "Asian H/L", desc: "Alertes sans veiller — review matin." }, { title: "Energy score", desc: "Seuil skip session si <6." }] },
  "pro-tilt": { intro: "Protocole signé.", tasks: [{ title: "Triggers", desc: "5 triggers tilt personnels." }, { title: "2 loss protocol", desc: "Actions exactes 24h off." }, { title: "Escalation", desc: "Ladder si violation." }, { title: "Buddy", desc: "Nom partenaire accountability." }] },
};

const CHART_EXERCISE_SECTION =
  '\n    <section class="chart-exercise-section">\n      <h2>Exercice sur chart — à faire sur TradingView</h2>\n      <p style="color:var(--muted);font-size:0.88rem;margin-bottom:0.75rem">Reproduisez le cas du module sur chart réel ou replay — cochez chaque tâche puis enregistrez.</p>\n      <div id="chart-exercise-root"></div>\n    </section>\n';

function detectModuleIdFromPage() {
  const scripts = document.querySelectorAll("script:not([src])");
  for (let i = 0; i < scripts.length; i++) {
    const m = scripts[i].textContent.match(/moduleId:\s*"([^"]+)"/);
    if (m) return m[1];
  }
  return null;
}

function autoInitChartExercise() {
  const root = document.getElementById("chart-exercise-root");
  if (!root || root.dataset.initialized === "1" || root.innerHTML.trim()) return;
  const id = detectModuleIdFromPage();
  const cfg = id && CHART_EXERCISE_REGISTRY[id];
  if (!cfg || typeof initChartExercise !== "function") return;
  root.dataset.initialized = "1";
  initChartExercise(id, cfg);
}

document.addEventListener("DOMContentLoaded", autoInitChartExercise);
window.CHART_EXERCISE_REGISTRY = CHART_EXERCISE_REGISTRY;
window.autoInitChartExercise = autoInitChartExercise;
