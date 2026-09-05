import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Database, Flag, Globe2, Library } from "lucide-react";
import type {
  ConflictListItemDto,
  StatsOverviewDto,
} from "@usa-war-atlas/shared";
import { INTERVENTION_CATEGORIES } from "@usa-war-atlas/shared";
import { getConflicts, getStatsOverview } from "../lib/api";
import { ConflictCard } from "../components/ConflictCard";
import { Badge } from "../components/Badge";
import { categoryBadgeClass, categoryLabel } from "../lib/categories";

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Flag;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-base-surface2 bg-base-surface p-5">
      <Icon size={18} className="mb-3 text-content-secondary" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-content-secondary">{label}</div>
    </div>
  );
}

export function HomePage() {
  const [stats, setStats] = useState<StatsOverviewDto | null>(null);
  const [conflicts, setConflicts] = useState<ConflictListItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getStatsOverview(),
      getConflicts({ sort: "-startDate", limit: 6 }),
    ])
      .then(([statsRes, conflictsRes]) => {
        setStats(statsRes.data);
        setConflicts(conflictsRes.data);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-14">
      {/* En-tête */}
      <section className="pt-6 lg:pt-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-category-economic">
          Atlas historique et géopolitique
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight lg:text-5xl">
          Explorez deux siècles de guerres, d'interventions et de puissance
          américaine.
        </h1>
        <p className="mt-5 max-w-2xl leading-relaxed text-content-secondary">
          USA War Atlas documente les guerres directes, interventions limitées,
          conflits par procuration, opérations clandestines, pressions
          économiques et acquisitions territoriales des États-Unis. Chaque
          information importante est reliée à une source, et les faits établis
          sont distingués des justifications officielles, des estimations et
          des points débattus.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/conflits"
            className="inline-flex items-center gap-2 rounded-lg bg-content-primary px-5 py-2.5 text-sm font-semibold text-base-bg transition-opacity hover:opacity-90"
          >
            Explorer les conflits
            <ArrowRight size={16} />
          </Link>
          <Link
            to="/carte"
            className="inline-flex items-center gap-2 rounded-lg border border-base-surface2 bg-base-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:border-content-secondary/40"
          >
            <Globe2 size={16} />
            Voir la carte mondiale
          </Link>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          Impossible de charger les données : {error}. Vérifiez que l'API est
          démarrée (npm run dev).
        </div>
      )}

      {/* Statistiques générales */}
      {stats && (
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Flag}
            value={String(stats.totalConflicts)}
            label="Dossiers de conflits documentés"
          />
          <StatCard
            icon={Globe2}
            value={String(stats.countriesInvolved)}
            label="Pays impliqués"
          />
          <StatCard
            icon={Library}
            value={String(stats.totalSources)}
            label="Sources référencées"
          />
          <StatCard
            icon={Database}
            value={
              stats.firstConflictYear && stats.latestConflictYear
                ? `${stats.firstConflictYear}–${stats.latestConflictYear}`
                : "—"
            }
            label="Période couverte"
          />
        </section>
      )}

      {/* Catégories */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">
          Six catégories d'intervention
        </h2>
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-content-secondary">
          Chaque dossier est classé selon la nature principale de
          l'intervention américaine, de la guerre ouverte à la pression
          économique, en passant par les opérations clandestines.
        </p>
        <div className="flex flex-wrap gap-2">
          {INTERVENTION_CATEGORIES.map((c) => (
            <Link key={c} to={`/conflits?category=${c}`}>
              <Badge
                className={`${categoryBadgeClass[c]} px-3 py-1.5 text-sm hover:brightness-125`}
              >
                {categoryLabel(c)}
              </Badge>
            </Link>
          ))}
        </div>
      </section>

      {/* Conflits récents */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Dossiers récents</h2>
          <Link
            to="/conflits"
            className="inline-flex items-center gap-1 text-sm text-content-secondary hover:text-content-primary"
          >
            Tous les conflits <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {conflicts.map((c) => (
            <ConflictCard key={c.id} conflict={c} />
          ))}
        </div>
      </section>

      {/* Avertissement éditorial */}
      <section className="rounded-xl border border-base-surface2 bg-base-surface p-6">
        <h2 className="mb-2 text-base font-semibold">Démarche éditoriale</h2>
        <p className="text-sm leading-relaxed text-content-secondary">
          Cette application n'est ni militante ni propagandiste. Elle distingue
          systématiquement les faits établis, les justifications officielles,
          les analyses historiques, les interprétations, les faits débattus et
          les estimations. Le contenu actuel est un socle initial de
          démonstration : chaque dossier est marqué comme « à vérifier » tant
          qu'il n'a pas fait l'objet d'une relecture éditoriale complète.
        </p>
      </section>
    </div>
  );
}
