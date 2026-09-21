#!/usr/bin/env bash
# Crée / met à jour la 1ère fiche coaching Nassim sur le VPS.
#
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/SEED-FICHE-NASSIM.sh | bash
# Avant merge :
#   REF=cursor/seed-fiche-nassim-691a curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/SEED-FICHE-NASSIM.sh" | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
STORE="${APP_DIR}/data/coaching-fiches/index.json"

mkdir -p "$(dirname "$STORE")"

STORE="$STORE" node <<'NODE'
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const storePath = process.env.STORE;
fs.mkdirSync(path.dirname(storePath), { recursive: true });

function read() {
  try {
    const j = JSON.parse(fs.readFileSync(storePath, "utf8"));
    return Array.isArray(j.fiches) ? j.fiches : [];
  } catch (_) {
    return [];
  }
}

const now = new Date().toISOString();
const fiche = {
  id: "cf_nassim_diag001",
  shareToken: crypto.randomBytes(18).toString("base64url"),
  shared: false,
  createdAt: now,
  updatedAt: now,
  createdBy: "seed",
  studentName: "Nassim",
  studentEmail: "",
  date: "2026-09-21",
  moduleTheme: "Diagnostic initial — Fondamental & organisation (coaching individuel)",
  duration: "",
  positives: [
    "Curieux et intéressé par la macro/fondamental.",
    "Consulte déjà régulièrement rapports et actualités.",
    "Identifie lui-même ses difficultés.",
    "Bonne volonté et envie réelle de progresser.",
    "Accepte la nécessité de travailler sérieusement entre les coachings.",
  ],
  difficulties: [
    "Trop d’informations absorbées simultanément.",
    "Difficulté à classer et hiérarchiser l’information.",
    "Difficulté à mesurer l’importance réelle d’une annonce.",
    "Compréhension encore fragile des liens entre taux, liquidité, flux et actifs.",
    "Tendance à dépendre de ChatGPT pour organiser/interpréter l’information.",
    "Manque de régularité lorsque l’activité professionnelle reprend.",
  ],
  priorityAxis:
    "Transformer l’information en raisonnement structuré plutôt que chercher davantage d’informations.",
  mustUnderstand: [
    "Chaîne : Information → impact économique → anticipation du marché → flux → actif.",
    "Priorité aux bases : politique monétaire ; taux et anticipations ; liquidité.",
    "Corrélations et identification des catalyseurs dominants.",
  ],
  mustDo: [
    "Résumer le contexte de marché avec ses propres mots.",
    "Sélectionner 2 à 3 informations importantes parmi beaucoup d’autres et expliquer pourquoi.",
    "Identifier quels actifs peuvent être impactés et construire un scénario simple sans dépendre immédiatement de ChatGPT.",
  ],
  exercise1:
    "Choisir 3 informations maximum dans la semaine et répondre pour chacune : Que s’est-il passé ? Pourquoi est-ce important ? Qu’est-ce que cela impacte ? Quel actif est concerné ?",
  exercise2: "",
  routine: "Carnet obligatoire + notes personnelles avant de demander l’analyse de ChatGPT.",
  errorsToAvoid: [
    "Lire trop d’informations sans objectif précis.",
    "Vouloir comprendre plusieurs niveaux en même temps / passer à une nouvelle notion avant d’avoir assimilé la précédente.",
    "Confondre quantité d’informations et qualité d’analyse ; arrêter complètement le travail dès que l’emploi du temps devient chargé.",
  ],
  nextLiveGoal:
    "Vérifier que Nassim peut expliquer seul ce qui a principalement drivé le marché durant la semaine et sélectionner 3 informations maximum pour justifier son raisonnement.",
  evolution: {
    comprehension: "progres",
    regularite: "faible",
    autonomie: "progres",
    application: "faible",
  },
  coachKeyPoint:
    "Nassim ne manque pas d’informations. Son principal besoin est d’apprendre à filtrer, hiérarchiser et relier les informations entre elles. La priorité n’est pas d’ajouter de la complexité mais de construire progressivement une mécanique de raisonnement simple et répétable.",
  axeDuMoment: "STRUCTURE — HIÉRARCHISATION — COMPRÉHENSION — RÉGULARITÉ",
  coachPrivateNotes:
    "Diagnostic initial. Surveiller la dépendance à ChatGPT et la régularité quand le job reprend. Prochain live = test de restitution 3 infos max.",
};

let fiches = read();
const idx = fiches.findIndex(
  (f) => f.id === fiche.id || String(f.studentName || "").toLowerCase() === "nassim"
);
if (idx >= 0) {
  fiche.shareToken = fiches[idx].shareToken || fiche.shareToken;
  fiche.shared = Boolean(fiches[idx].shared);
  fiche.createdAt = fiches[idx].createdAt || fiche.createdAt;
  fiche.studentEmail = fiches[idx].studentEmail || "";
  fiches[idx] = Object.assign({}, fiches[idx], fiche, { updatedAt: now });
  console.log("OK — fiche Nassim mise à jour :", fiches[idx].id);
} else {
  fiches.push(fiche);
  console.log("OK — fiche Nassim créée :", fiche.id);
}

const tmp = storePath + ".tmp";
fs.writeFileSync(tmp, JSON.stringify({ fiches, updated: now }, null, 2));
fs.renameSync(tmp, storePath);
console.log("Store:", storePath, "| Total fiches:", fiches.length);
NODE

echo ""
echo "→ https://app.torinvest-trading.com/coaching-fiches.html  (compte admin)"
echo "======== DONE ========"
