import type {
  EconomicMetricType,
  TerritoryCoverageType,
} from "@usa-war-atlas/shared";

export const coverageLabels: Record<TerritoryCoverageType, string> = {
  FULL: "Totalité de l'État",
  MOSTLY: "Majeure partie",
  PARTIAL: "Partie de l'État",
  SMALL_PART: "Petite partie",
};

export const coverageBadgeClass: Record<TerritoryCoverageType, string> = {
  FULL: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  MOSTLY: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  PARTIAL: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  SMALL_PART: "bg-gray-500/15 text-gray-400 border-gray-500/40",
};

export const metricTypeLabels: Record<EconomicMetricType, string> = {
  GDP: "PIB",
  FEDERAL_TAX_COLLECTIONS: "Recettes fiscales fédérales",
  FEDERAL_SPENDING: "Dépenses fédérales reçues",
  POPULATION: "Population",
  LAND_VALUE: "Valeur foncière",
  RESOURCE_OUTPUT: "Production de ressources",
  EXPORTS: "Exportations",
};

export function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR");
}

export function formatArea(km2: number): string {
  return `${formatNumber(Math.round(km2))} km²`;
}

/** Montant nominal : « 15 000 000 $ (dollars de 1848, non corrigés) ». */
export function formatHistoricalPrice(
  value: number,
  currency: string | null,
  year: number | null
): string {
  const amount = `${formatNumber(value)} ${currency === "USD" || !currency ? "$" : currency}`;
  return year ? `${amount}` : amount;
}
