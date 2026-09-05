import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  Landmark,
  Ruler,
  Wallet,
} from "lucide-react";
import type { TerritoryListItemDto } from "@usa-war-atlas/shared";
import { getTerritories } from "../lib/api";
import { Badge } from "../components/Badge";
import { formatDate } from "../lib/categories";
import {
  coverageBadgeClass,
  coverageLabels,
  formatArea,
  formatNumber,
} from "../lib/territory-utils";

export function TerritoriesPage() {
  const [territories, setTerritories] = useState<TerritoryListItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTerritories()
      .then((res) => setTerritories(res.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="pt-2">
        <h1 className="text-3xl font-bold">Acquisitions territoriales</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-secondary">
          Territoires passés sous souveraineté américaine à la suite de guerres
          ou de traités : ancien souverain, date, prix payé, superficie, États
          modernes concernés et indicateurs économiques actuels — chacun avec
          son année, sa source, son périmètre et sa méthode.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-relaxed text-amber-200/80">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>
          Avertissement méthodologique : les frontières actuelles des États ne
          correspondent pas exactement aux territoires historiques acquis. Les
          indicateurs économiques modernes décrivent les États d'aujourd'hui et
          ne mesurent en aucun cas un « bénéfice » des guerres ou des traités
          d'acquisition. Voir la méthodologie complète dans la documentation du
          projet.
        </p>
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
        <div className="space-y-5">
          {territories.map((t) => (
            <Link
              key={t.id}
              to={`/territoires/${t.slug}`}
              className="group block rounded-xl border border-base-surface2 bg-base-surface p-6 transition-colors hover:border-content-secondary/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Landmark size={16} className="text-content-secondary" />
                <h2 className="text-lg font-semibold group-hover:underline">
                  {t.name}
                </h2>
                {t.needsReview && (
                  <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-400">
                    À vérifier
                  </Badge>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-content-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarRange size={14} />
                  {t.acquisitionDate ? formatDate(t.acquisitionDate) : "Date à vérifier"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Ruler size={14} />
                  {t.areaKm2 ? `≈ ${formatArea(t.areaKm2)}` : "Superficie à vérifier"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Wallet size={14} />
                  {t.originalPrice != null
                    ? `${formatNumber(t.originalPrice)} $ (nominal)`
                    : "Prix à vérifier"}
                </span>
              </div>

              <p className="mt-3 text-sm text-content-secondary">
                {t.formerSovereign} → {t.newSovereign}
                {t.treatyName ? ` · ${t.treatyName}` : ""}
                {t.conflict ? ` · lié à : ${t.conflict.title}` : ""}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.states.map((s) => (
                  <Badge key={s.id} className={coverageBadgeClass[s.coverageType]}>
                    {s.stateName} · {coverageLabels[s.coverageType]}
                  </Badge>
                ))}
              </div>

              <span className="mt-4 inline-flex items-center gap-1 text-sm text-content-secondary group-hover:text-content-primary">
                Voir le détail et les indicateurs <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
