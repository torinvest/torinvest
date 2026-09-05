import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Library, Search } from "lucide-react";
import type {
  ReliabilityLevel,
  SourceType,
  SourceWithConflictsDto,
} from "@usa-war-atlas/shared";
import { RELIABILITY_LEVELS, SOURCE_TYPES } from "@usa-war-atlas/shared";
import { getSources } from "../lib/api";
import { Badge } from "../components/Badge";
import { formatDate } from "../lib/categories";

const sourceTypeLabels: Record<SourceType, string> = {
  GOVERNMENT: "Gouvernement",
  ACADEMIC: "Académique",
  INTERNATIONAL_ORGANIZATION: "Organisation internationale",
  BOOK: "Livre",
  PRESS: "Presse",
  DATABASE: "Base de données",
  ARCHIVE: "Archives",
};

const reliabilityLabels: Record<ReliabilityLevel, string> = {
  HIGH: "Fiabilité élevée",
  MEDIUM: "Fiabilité moyenne",
  LOW: "Fiabilité faible",
  CONTESTED: "Contestée",
};

const reliabilityBadgeClass: Record<ReliabilityLevel, string> = {
  HIGH: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  MEDIUM: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  LOW: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  CONTESTED: "bg-red-500/15 text-red-400 border-red-500/40",
};

export function SourcesPage() {
  const [sources, setSources] = useState<SourceWithConflictsDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [reliabilityFilter, setReliabilityFilter] = useState("");
  const [conflictFilter, setConflictFilter] = useState("");

  useEffect(() => {
    getSources()
      .then((res) => setSources(res.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const conflictOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sources) {
      for (const c of s.conflicts) map.set(c.conflict.slug, c.conflict.title);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sources]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sources.filter((s) => {
      if (typeFilter && s.sourceType !== typeFilter) return false;
      if (reliabilityFilter && s.reliabilityLevel !== reliabilityFilter) {
        return false;
      }
      if (
        conflictFilter &&
        !s.conflicts.some((c) => c.conflict.slug === conflictFilter)
      ) {
        return false;
      }
      if (
        term &&
        !s.title.toLowerCase().includes(term) &&
        !(s.publisher ?? "").toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [sources, search, typeFilter, reliabilityFilter, conflictFilter]);

  const selectClass =
    "rounded-lg border border-base-surface2 bg-base-surface px-3 py-2 text-sm focus:border-content-secondary/50 focus:outline-none";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="pt-2">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <Library size={28} className="text-content-secondary" />
          Sources
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-secondary">
          Toutes les sources référencées dans l'atlas : organisme, type, date,
          niveau de fiabilité et dossiers associés. Chaque information
          importante de l'application doit pouvoir être reliée à l'une d'elles.
        </p>
      </header>

      {/* Filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-56">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-secondary"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Titre ou organisme…"
            className="w-full rounded-lg border border-base-surface2 bg-base-surface py-2 pl-9 pr-3 text-sm placeholder:text-content-secondary focus:border-content-secondary/50 focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">Tous les types</option>
          {SOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {sourceTypeLabels[t]}
            </option>
          ))}
        </select>
        <select
          value={reliabilityFilter}
          onChange={(e) => setReliabilityFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">Toute fiabilité</option>
          {RELIABILITY_LEVELS.map((r) => (
            <option key={r} value={r}>
              {reliabilityLabels[r]}
            </option>
          ))}
        </select>
        <select
          value={conflictFilter}
          onChange={(e) => setConflictFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">Tous les conflits</option>
          {conflictOptions.map(([slug, title]) => (
            <option key={slug} value={slug}>
              {title}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          Erreur : {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-content-secondary">
          Chargement…
        </div>
      ) : (
        <>
          <p className="text-xs text-content-secondary">
            {filtered.length} source(s) sur {sources.length}
          </p>
          <div className="space-y-4">
            {filtered.map((s) => (
              <article
                key={s.id}
                className="rounded-xl border border-base-surface2 bg-base-surface p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-base-surface2 bg-base-surface2/60 text-content-secondary">
                    {sourceTypeLabels[s.sourceType]}
                  </Badge>
                  <Badge className={reliabilityBadgeClass[s.reliabilityLevel]}>
                    {reliabilityLabels[s.reliabilityLevel]}
                  </Badge>
                </div>

                <h2 className="mt-2 font-semibold leading-snug">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 underline decoration-content-secondary/40 underline-offset-2 hover:decoration-content-primary"
                    >
                      {s.title}
                      <ExternalLink size={13} className="shrink-0" />
                    </a>
                  ) : (
                    s.title
                  )}
                </h2>

                <p className="mt-1 text-xs text-content-secondary">
                  {[
                    s.publisher,
                    s.publicationDate
                      ? `publié : ${formatDate(s.publicationDate)}`
                      : null,
                    s.accessedAt
                      ? `consulté : ${formatDate(s.accessedAt)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                {s.notes && (
                  <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                    {s.notes}
                  </p>
                )}

                {s.conflicts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.conflicts.map((c) => (
                      <Link key={c.conflict.slug} to={`/conflits/${c.conflict.slug}`}>
                        <Badge className="border-base-surface2 bg-base-surface2/60 text-content-secondary hover:text-content-primary">
                          {c.conflict.title}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
