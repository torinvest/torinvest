import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { ConflictListItemDto, PaginationMeta } from "@usa-war-atlas/shared";
import { INTERVENTION_CATEGORIES } from "@usa-war-atlas/shared";
import { getConflicts } from "../lib/api";
import { ConflictCard } from "../components/ConflictCard";
import { categoryLabel } from "../lib/categories";

const SORT_OPTIONS = [
  { value: "startDate", label: "Plus anciens d'abord" },
  { value: "-startDate", label: "Plus récents d'abord" },
  { value: "title", label: "Titre A→Z" },
  { value: "-title", label: "Titre Z→A" },
] as const;

export function ConflictsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conflicts, setConflicts] = useState<ConflictListItemDto[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const category = searchParams.get("category") ?? "";
  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") ?? "startDate";
  const page = Number(searchParams.get("page") ?? "1");

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== "page") next.delete("page"); // retour page 1 quand un filtre change
    setSearchParams(next);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    getConflicts({
      category: category || undefined,
      search: search || undefined,
      sort,
      page,
      limit: 12,
    })
      .then((res) => {
        setConflicts(res.data);
        setMeta(res.meta ?? null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, search, sort, page]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="pt-2">
        <h1 className="text-3xl font-bold">Conflits et interventions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-secondary">
          Liste des dossiers documentés, filtrable par catégorie et par
          recherche textuelle. Contenu initial de démonstration, en cours
          d'enrichissement.
        </p>
      </header>

      {/* Filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-secondary"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => updateParam("search", e.target.value)}
            placeholder="Rechercher un conflit…"
            className="w-full rounded-lg border border-base-surface2 bg-base-surface py-2 pl-9 pr-3 text-sm placeholder:text-content-secondary focus:border-content-secondary/50 focus:outline-none"
          />
        </div>
        <select
          value={category}
          onChange={(e) => updateParam("category", e.target.value)}
          className="rounded-lg border border-base-surface2 bg-base-surface px-3 py-2 text-sm focus:border-content-secondary/50 focus:outline-none"
        >
          <option value="">Toutes les catégories</option>
          {INTERVENTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="rounded-lg border border-base-surface2 bg-base-surface px-3 py-2 text-sm focus:border-content-secondary/50 focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Résultats */}
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          Erreur : {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-content-secondary">
          Chargement…
        </div>
      ) : conflicts.length === 0 ? (
        <div className="rounded-xl border border-base-surface2 bg-base-surface py-16 text-center text-sm text-content-secondary">
          Aucun conflit ne correspond à ces critères.
        </div>
      ) : (
        <>
          <p className="text-xs text-content-secondary">
            {meta?.total ?? conflicts.length} dossier(s) trouvé(s)
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {conflicts.map((c) => (
              <ConflictCard key={c.id} conflict={c} />
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => updateParam("page", String(page - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-base-surface2 bg-base-surface px-3 py-1.5 text-sm disabled:opacity-40"
          >
            <ChevronLeft size={15} /> Précédent
          </button>
          <span className="text-sm text-content-secondary">
            Page {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= meta.totalPages}
            onClick={() => updateParam("page", String(page + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-base-surface2 bg-base-surface px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Suivant <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
