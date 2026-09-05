import type { CertaintyLevel, InterventionCategory } from "@usa-war-atlas/shared";
import { CATEGORY_LABELS_FR, CERTAINTY_LABELS_FR } from "@usa-war-atlas/shared";

export const categoryLabel = (c: InterventionCategory) => CATEGORY_LABELS_FR[c];
export const certaintyLabel = (c: CertaintyLevel) => CERTAINTY_LABELS_FR[c];

/** Classes Tailwind (badge) par catégorie d'intervention. */
export const categoryBadgeClass: Record<InterventionCategory, string> = {
  DIRECT_WAR: "bg-category-direct/15 text-category-direct border-category-direct/40",
  LIMITED_MILITARY_INTERVENTION:
    "bg-category-limited/15 text-category-limited border-category-limited/40",
  INDIRECT_CONFLICT:
    "bg-category-indirect/15 text-category-indirect border-category-indirect/40",
  COVERT_OPERATION:
    "bg-category-covert/15 text-category-covert border-category-covert/40",
  ECONOMIC_PRESSURE:
    "bg-category-economic/15 text-category-economic border-category-economic/40",
  HYBRID_CONFLICT:
    "bg-category-hybrid/15 text-category-hybrid border-category-hybrid/40",
};

/** Couleurs hexadécimales par catégorie (marqueurs de carte, graphiques).
    Doivent rester alignées avec tailwind.config.js. */
export const categoryHexColor: Record<InterventionCategory, string> = {
  DIRECT_WAR: "#DC6B6B",
  LIMITED_MILITARY_INTERVENTION: "#E8925A",
  INDIRECT_CONFLICT: "#E3A857",
  COVERT_OPERATION: "#9B7EDE",
  ECONOMIC_PRESSURE: "#5B9BD5",
  HYBRID_CONFLICT: "#D4C05A",
};

export const certaintyBadgeClass: Record<CertaintyLevel, string> = {
  ESTABLISHED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  HIGH_CONFIDENCE: "bg-teal-500/15 text-teal-400 border-teal-500/40",
  ESTIMATE: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  DISPUTED: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  OFFICIAL_CLAIM: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  INTERPRETATION: "bg-violet-500/15 text-violet-400 border-violet-500/40",
  UNKNOWN: "bg-gray-500/15 text-gray-400 border-gray-500/40",
};

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatYearRange(
  start: string,
  end: string | null,
  isOngoing: boolean
): string {
  const startYear = new Date(start).getFullYear();
  if (isOngoing) return `${startYear} – en cours`;
  if (!end) return `${startYear} – ?`;
  const endYear = new Date(end).getFullYear();
  return startYear === endYear ? `${startYear}` : `${startYear} – ${endYear}`;
}
