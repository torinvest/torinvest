import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ConflictListItemDto,
  TimelineBucketDto,
} from "@usa-war-atlas/shared";
import { getConflicts, getStatsTimeline } from "../lib/api";
import { Badge } from "../components/Badge";
import {
  categoryBadgeClass,
  categoryLabel,
  formatYearRange,
} from "../lib/categories";

/**
 * Périodes historiques structurant la frise. Les bornes sont indicatives :
 * elles servent au regroupement visuel, pas à une périodisation savante.
 */
const PERIODS = [
  {
    id: "expansion",
    label: "Expansion territoriale",
    from: 1783,
    to: 1897,
    description:
      "De l'indépendance à la fin du XIXe siècle : expansion continentale, guerre de 1812, guerre américano-mexicaine, conquête de l'Ouest.",
  },
  {
    id: "imperialisme",
    label: "Impérialisme",
    from: 1898,
    to: 1913,
    description:
      "Guerre hispano-américaine, annexions d'outre-mer, guerre américano-philippine, interventions caribéennes.",
  },
  {
    id: "guerres-mondiales",
    label: "Guerres mondiales",
    from: 1914,
    to: 1945,
    description:
      "Les deux guerres mondiales et l'ascension des États-Unis au rang de superpuissance.",
  },
  {
    id: "guerre-froide",
    label: "Guerre froide",
    from: 1946,
    to: 1991,
    description:
      "Endiguement du communisme : Corée, Vietnam, Laos, Cambodge, opérations clandestines, guerres par procuration.",
  },
  {
    id: "post-sovietique",
    label: "Monde post-soviétique",
    from: 1992,
    to: 2000,
    description:
      "L'hyperpuissance des années 1990 : Somalie, Balkans, interventions « humanitaires ».",
  },
  {
    id: "terrorisme",
    label: "Guerre contre le terrorisme",
    from: 2001,
    to: 2015,
    description:
      "Après le 11 septembre : Afghanistan, Irak, drones, Libye, lutte contre l'État islamique.",
  },
  {
    id: "contemporain",
    label: "Rivalités contemporaines",
    from: 2016,
    to: 2100,
    description:
      "Compétition entre grandes puissances, sanctions économiques, conflits hybrides.",
  },
] as const;

function periodOf(startDate: string) {
  const year = new Date(startDate).getFullYear();
  return PERIODS.find((p) => year >= p.from && year <= p.to) ?? null;
}

export function TimelinePage() {
  const [conflicts, setConflicts] = useState<ConflictListItemDto[]>([]);
  const [buckets, setBuckets] = useState<TimelineBucketDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getConflicts({ limit: 100, sort: "startDate" }),
      getStatsTimeline(),
    ])
      .then(([conflictsRes, timelineRes]) => {
        setConflicts(conflictsRes.data);
        setBuckets(timelineRes.data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const byPeriod = useMemo(() => {
    const map = new Map<string, ConflictListItemDto[]>();
    for (const c of conflicts) {
      const period = periodOf(c.startDate);
      if (!period) continue;
      const list = map.get(period.id) ?? [];
      list.push(c);
      map.set(period.id, list);
    }
    return map;
  }, [conflicts]);

  const chartData = useMemo(
    () => buckets.map((b) => ({ decade: `${b.decade}`, count: b.count })),
    [buckets]
  );

  if (loading) {
    return (
      <div className="py-24 text-center text-sm text-content-secondary">
        Chargement…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="pt-2">
        <h1 className="text-3xl font-bold">Chronologie</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-secondary">
          Deux siècles d'interventions regroupés par grandes périodes
          historiques. Les bornes des périodes sont indicatives et servent à la
          lecture, pas à une périodisation savante.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          Erreur : {error}
        </div>
      )}

      {/* Répartition par décennie */}
      {chartData.length > 0 && (
        <section className="rounded-xl border border-base-surface2 bg-base-surface p-6">
          <h2 className="mb-4 text-base font-semibold">
            Conflits démarrés par décennie
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis
                  dataKey="decade"
                  tick={{ fill: "#9CA3AF", fontSize: 11 }}
                  stroke="#1F2937"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#9CA3AF", fontSize: 11 }}
                  stroke="#1F2937"
                />
                <Tooltip
                  cursor={{ fill: "#1F293755" }}
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #1F2937",
                    borderRadius: 8,
                    color: "#F9FAFB",
                    fontSize: 12,
                  }}
                  formatter={(value) => [value, "conflits"]}
                  labelFormatter={(label) => `Décennie ${label}`}
                />
                <Bar dataKey="count" fill="#5B9BD5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Frise par périodes */}
      <div className="space-y-10">
        {PERIODS.map((period) => {
          const items = byPeriod.get(period.id) ?? [];
          return (
            <section key={period.id}>
              <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                <h2 className="text-xl font-semibold">{period.label}</h2>
                <span className="text-xs text-content-secondary">
                  {period.from}
                  {period.to < 2100 ? `–${period.to}` : "– aujourd'hui"}
                </span>
              </div>
              <p className="mb-4 max-w-2xl text-sm leading-relaxed text-content-secondary">
                {period.description}
              </p>

              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-base-surface2 px-4 py-3 text-xs italic text-content-secondary">
                  Aucun dossier documenté pour cette période dans le seed
                  actuel — à enrichir.
                </p>
              ) : (
                <ol className="relative space-y-4 border-l border-base-surface2 pl-6">
                  {items.map((c) => (
                    <li key={c.id} className="relative">
                      <span className="absolute -left-[31px] top-2 h-2.5 w-2.5 rounded-full bg-content-secondary" />
                      <Link
                        to={`/conflits/${c.slug}`}
                        className="group block rounded-xl border border-base-surface2 bg-base-surface p-4 transition-colors hover:border-content-secondary/40"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
                            {formatYearRange(c.startDate, c.endDate, c.isOngoing)}
                          </span>
                          <Badge className={categoryBadgeClass[c.primaryCategory]}>
                            {categoryLabel(c.primaryCategory)}
                          </Badge>
                          {c.isOngoing && (
                            <Badge className="border-red-500/40 bg-red-500/10 text-red-400">
                              En cours
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 font-semibold group-hover:underline">
                          {c.title}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-content-secondary">
                          {c.summary}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
