import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, GitCompareArrows } from "lucide-react";
import type {
  ConflictCompareDto,
  ConflictListItemDto,
} from "@usa-war-atlas/shared";
import { getCompare, getConflicts } from "../lib/api";
import { Badge } from "../components/Badge";
import {
  categoryBadgeClass,
  categoryLabel,
  formatYearRange,
} from "../lib/categories";

/** Durée lisible entre deux dates (approximative, en années/mois). */
function formatDuration(start: string, end: string | null, isOngoing: boolean): string {
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : isOngoing ? Date.now() : NaN;
  if (Number.isNaN(to)) return "Donnée à vérifier";
  const months = Math.max(1, Math.round((to - from) / (30.44 * 24 * 3600 * 1000)));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years > 0 ? `${years} an${years > 1 ? "s" : ""}` : null,
    rest > 0 ? `${rest} mois` : null,
  ].filter(Boolean);
  return (parts.join(" et ") || "moins d'un mois") + (isOngoing ? " (en cours)" : "");
}

function casualtiesSummary(c: ConflictCompareDto): string {
  const us = c.casualtyEstimates.find((e) => e.category === "MILITARY_US");
  if (!us) return "Donnée à vérifier";
  const fmt = (n: number) => n.toLocaleString("fr-FR");
  if (us.bestEstimate != null) return `${fmt(us.bestEstimate)} morts militaires US`;
  if (us.minimumValue != null && us.maximumValue != null) {
    return `${fmt(us.minimumValue)} – ${fmt(us.maximumValue)} morts militaires US`;
  }
  return "Donnée à vérifier";
}

function opponents(c: ConflictCompareDto): string {
  const names = c.countries
    .filter((cc) => cc.role === "TARGET" || (cc.role === "BELLIGERENT" && cc.country.iso3 !== "USA"))
    .map((cc) => cc.country.name);
  return names.length > 0 ? names.join(", ") : "—";
}

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allConflicts, setAllConflicts] = useState<ConflictListItemDto[]>([]);
  const [compared, setCompared] = useState<ConflictCompareDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const slugA = searchParams.get("a") ?? "";
  const slugB = searchParams.get("b") ?? "";

  useEffect(() => {
    getConflicts({ limit: 100, sort: "startDate" })
      .then((res) => setAllConflicts(res.data))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!slugA || !slugB || slugA === slugB) {
      setCompared(null);
      return;
    }
    setLoading(true);
    setError(null);
    getCompare([slugA, slugB])
      .then((res) => setCompared(res.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slugA, slugB]);

  const setSlug = (key: "a" | "b", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const rows = useMemo(() => {
    if (!compared || compared.length < 2) return [];
    const [a, b] = compared;
    const textRow = (
      label: string,
      pick: (c: ConflictCompareDto) => string | null,
      officialClaim = false
    ) => ({
      label,
      a: pick(a) ?? "Donnée à vérifier",
      b: pick(b) ?? "Donnée à vérifier",
      officialClaim,
    });
    return [
      textRow("Période", (c) => formatYearRange(c.startDate, c.endDate, c.isOngoing)),
      textRow("Durée", (c) => formatDuration(c.startDate, c.endDate, c.isOngoing)),
      textRow("Catégorie", (c) => categoryLabel(c.primaryCategory)),
      textRow("Région", (c) => c.region),
      textRow("Adversaires / cibles", opponents),
      textRow("Pertes estimées", casualtiesSummary),
      textRow("Justification officielle", (c) => c.officialJustification, true),
      textRow("Base juridique", (c) => c.legalBasis),
      textRow("Résultat militaire", (c) => c.militaryResult),
      textRow("Résultat politique", (c) => c.politicalResult),
      textRow("Conséquences territoriales", (c) => c.territorialConsequences),
      textRow("Sources", (c) =>
        c.sources.length > 0
          ? c.sources.map((s) => s.source.title).join(" · ")
          : null
      ),
    ];
  }, [compared]);

  const selectClass =
    "w-full rounded-lg border border-base-surface2 bg-base-surface px-3 py-2 text-sm focus:border-content-secondary/50 focus:outline-none";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="pt-2">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <GitCompareArrows size={28} className="text-content-secondary" />
          Comparateur de conflits
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-secondary">
          Sélectionnez deux dossiers pour comparer leurs dates, durée,
          catégorie, adversaires, pertes estimées, résultats et sources. Les
          justifications officielles sont présentées comme telles.
        </p>
      </header>

      {/* Sélection */}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["a", "b"] as const).map((key) => (
          <div key={key}>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-content-secondary">
              Conflit {key.toUpperCase()}
            </label>
            <select
              value={key === "a" ? slugA : slugB}
              onChange={(e) => setSlug(key, e.target.value)}
              className={selectClass}
            >
              <option value="">— Choisir un conflit —</option>
              {allConflicts.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.title} ({formatYearRange(c.startDate, c.endDate, c.isOngoing)})
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {slugA && slugB && slugA === slugB && (
        <p className="text-sm text-amber-400">
          Sélectionnez deux conflits différents.
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          Erreur : {error}
        </div>
      )}

      {loading && (
        <div className="py-10 text-center text-sm text-content-secondary">
          Chargement…
        </div>
      )}

      {/* Tableau comparatif */}
      {compared && compared.length === 2 && !loading && (
        <div className="overflow-x-auto rounded-xl border border-base-surface2">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-base-surface2 bg-base-surface">
                <th className="w-48 p-4" />
                {compared.map((c) => (
                  <th key={c.id} className="w-1/2 p-4 align-top">
                    <Badge className={categoryBadgeClass[c.primaryCategory]}>
                      {categoryLabel(c.primaryCategory)}
                    </Badge>
                    <Link
                      to={`/conflits/${c.slug}`}
                      className="mt-2 block text-base font-bold hover:underline"
                    >
                      {c.title}
                    </Link>
                    <Link
                      to={`/conflits/${c.slug}`}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-normal text-content-secondary hover:text-content-primary"
                    >
                      Voir la fiche complète <ArrowRight size={12} />
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-base-surface2/60 align-top last:border-0"
                >
                  <th className="bg-base-surface/60 p-4 text-xs font-semibold uppercase tracking-wide text-content-secondary">
                    {row.label}
                    {row.officialClaim && (
                      <span className="mt-1 block font-normal normal-case tracking-normal">
                        (présentée comme telle, pas comme un fait)
                      </span>
                    )}
                  </th>
                  <td className="p-4 leading-relaxed text-content-secondary">
                    {row.a}
                  </td>
                  <td className="p-4 leading-relaxed text-content-secondary">
                    {row.b}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
