import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Landmark,
  Ruler,
  Swords,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type {
  EconomicMetricDto,
  EconomicMetricType,
  TerritoryDetailDto,
} from "@usa-war-atlas/shared";
import { getTerritory } from "../lib/api";
import { Badge } from "../components/Badge";
import { StatBlock } from "../components/StatBlock";
import { formatDate } from "../lib/categories";
import {
  coverageBadgeClass,
  coverageLabels,
  formatArea,
  formatNumber,
  metricTypeLabels,
} from "../lib/territory-utils";

function groupMetrics(metrics: EconomicMetricDto[]) {
  const map = new Map<EconomicMetricType, EconomicMetricDto[]>();
  for (const m of metrics) {
    const list = map.get(m.metricType) ?? [];
    list.push(m);
    map.set(m.metricType, list);
  }
  return map;
}

export function TerritoryDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [territory, setTerritory] = useState<TerritoryDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    getTerritory(slug)
      .then((res) => setTerritory(res.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const metricsByType = useMemo(
    () => groupMetrics(territory?.economicMetrics ?? []),
    [territory]
  );

  if (loading) {
    return (
      <div className="py-24 text-center text-sm text-content-secondary">
        Chargement…
      </div>
    );
  }

  if (error || !territory) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pt-10">
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error ?? "Territoire introuvable"}
        </div>
        <Link
          to="/territoires"
          className="inline-flex items-center gap-2 text-sm text-content-secondary hover:text-content-primary"
        >
          <ArrowLeft size={15} /> Retour aux acquisitions territoriales
        </Link>
      </div>
    );
  }

  const acquisitionYear = territory.acquisitionDate
    ? new Date(territory.acquisitionDate).getFullYear()
    : null;

  const populationMetrics = metricsByType.get("POPULATION") ?? [];
  const populationTotal =
    populationMetrics.length > 0
      ? populationMetrics.reduce((sum, m) => sum + m.value, 0)
      : null;
  const populationYear = populationMetrics[0]?.year ?? null;
  const populationSource = populationMetrics[0]?.source?.publisher ?? null;

  const gdpMetrics = metricsByType.get("GDP") ?? [];
  const taxMetrics = metricsByType.get("FEDERAL_TAX_COLLECTIONS") ?? [];
  const spendingMetrics = metricsByType.get("FEDERAL_SPENDING") ?? [];

  const isMexicanCession = territory.slug === "cession-mexicaine-1848";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/territoires"
        className="inline-flex items-center gap-2 pt-2 text-sm text-content-secondary hover:text-content-primary"
      >
        <ArrowLeft size={15} /> Toutes les acquisitions territoriales
      </Link>

      {/* En-tête */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-base-surface2 bg-base-surface2/60 text-content-secondary">
            <Landmark size={11} /> Acquisition territoriale
          </Badge>
          {territory.needsReview && (
            <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-400">
              <AlertTriangle size={11} /> Contenu à vérifier
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
          {territory.name}
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-content-secondary">
          <span>
            {territory.formerSovereign} → {territory.newSovereign}
          </span>
          {territory.acquisitionDate && (
            <span>{formatDate(territory.acquisitionDate)}</span>
          )}
          {territory.treatyName && <span>{territory.treatyName}</span>}
        </div>
        {territory.description && (
          <p className="whitespace-pre-line leading-relaxed text-content-secondary">
            {territory.description}
          </p>
        )}
        {territory.conflict && (
          <Link
            to={`/conflits/${territory.conflict.slug}`}
            className="inline-flex items-center gap-2 rounded-lg border border-base-surface2 bg-base-surface px-4 py-2 text-sm font-medium transition-colors hover:border-content-secondary/40"
          >
            <Swords size={15} />
            Conflit associé : {territory.conflict.title}
          </Link>
        )}
      </header>

      {/* Avertissement méthodologique */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-relaxed text-amber-200/80">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div className="space-y-2">
          <p className="font-semibold text-amber-200">
            Avertissement méthodologique
          </p>
          {isMexicanCession ? (
            <ul className="list-disc space-y-1 pl-4">
              <li>
                Les frontières actuelles des États ne correspondent pas
                exactement aux territoires acquis en 1848.
              </li>
              <li>
                Certaines parties de l'Arizona et du Nouveau-Mexique
                proviennent de l'achat Gadsden (1853), pas de la cession de
                1848.
              </li>
              <li>
                Seules des parties du Colorado et du Wyoming étaient
                concernées.
              </li>
              <li>
                Le PIB moderne de ces États ne doit jamais être présenté comme
                un bénéfice direct de la guerre : la richesse actuelle résulte
                de plus de 175 ans de développement (population, capital,
                technologie) qui ne peut pas être attribué à l'acquisition
                elle-même.
              </li>
            </ul>
          ) : (
            <p>
              Les frontières actuelles des États ne correspondent pas
              exactement aux territoires historiques acquis, et les indicateurs
              économiques modernes ne mesurent pas un « bénéfice » de
              l'acquisition. Voir docs/DATA_METHODOLOGY.md.
            </p>
          )}
        </div>
      </div>

      {/* Blocs statistiques comparatifs */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Chiffres clés</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatBlock
            icon={<Wallet size={13} />}
            label="Prix historique de l'acquisition"
            value={
              territory.originalPrice != null
                ? `${formatNumber(territory.originalPrice)} $`
                : null
            }
            year={acquisitionYear}
            source={territory.treatyName ?? undefined}
            scope="Paiement prévu par le traité, hors créances et coûts de guerre"
            method={`Montant nominal en dollars de ${acquisitionYear ?? "l'époque"}, non corrigé de l'inflation`}
            status={territory.originalPrice != null ? "official" : "unverified"}
          />
          <StatBlock
            icon={<Banknote size={13} />}
            label="Valeur corrigée de l'inflation"
            value={
              territory.inflationAdjustedValue != null
                ? `${formatNumber(territory.inflationAdjustedValue)} $`
                : null
            }
            scope="Conversion du prix historique en dollars actuels"
            method="Laissée vide tant qu'une méthodologie sourcée (indice, année de référence) n'est pas documentée — les conversions sur longue période varient fortement selon l'indice choisi"
            status="unverified"
          />
          <StatBlock
            icon={<Ruler size={13} />}
            label="Superficie acquise"
            value={territory.areaKm2 ? `≈ ${formatArea(territory.areaKm2)}` : null}
            year={acquisitionYear}
            scope={
              isMexicanCession
                ? "Cession de 1848 uniquement, hors Texas et hors achat Gadsden"
                : "Territoire acquis à la date indiquée"
            }
            method="Superficie approximative, arrondie ; les délimitations historiques exactes font l'objet de mesures légèrement divergentes"
            status={territory.areaKm2 ? "estimate" : "unverified"}
          />
          <StatBlock
            icon={<Users size={13} />}
            label="Population actuelle des États concernés"
            value={populationTotal != null ? formatNumber(populationTotal) : null}
            year={populationYear}
            source={populationSource ?? undefined}
            scope="Somme des populations des États modernes entiers — un périmètre plus large que le territoire historique"
            method="Addition des populations officielles des États listés ci-dessous ; ne correspond pas à la population du territoire historique"
            status={populationTotal != null ? "estimate" : "unverified"}
          />
          <StatBlock
            icon={<TrendingUp size={13} />}
            label="PIB actuel des États concernés"
            value={
              gdpMetrics.length > 0
                ? `${formatNumber(gdpMetrics.reduce((s, m) => s + m.value, 0))} $`
                : null
            }
            year={gdpMetrics[0]?.year}
            source={gdpMetrics[0]?.source?.publisher ?? undefined}
            scope="États modernes entiers"
            method="Donnée non encore intégrée : à renseigner depuis le Bureau of Economic Analysis, avec année et périmètre"
            status={gdpMetrics.length > 0 ? "estimate" : "unverified"}
          />
          <StatBlock
            icon={<Banknote size={13} />}
            label="Recettes fiscales fédérales"
            value={
              taxMetrics.length > 0
                ? `${formatNumber(taxMetrics.reduce((s, m) => s + m.value, 0))} $`
                : null
            }
            year={taxMetrics[0]?.year}
            source={taxMetrics[0]?.source?.publisher ?? undefined}
            scope="États modernes entiers"
            method="Donnée non encore intégrée : à renseigner depuis l'IRS (collections par État), à présenter avec les dépenses fédérales reçues"
            status={taxMetrics.length > 0 ? "estimate" : "unverified"}
          />
          <StatBlock
            icon={<Banknote size={13} />}
            label="Dépenses fédérales reçues"
            value={
              spendingMetrics.length > 0
                ? `${formatNumber(spendingMetrics.reduce((s, m) => s + m.value, 0))} $`
                : null
            }
            year={spendingMetrics[0]?.year}
            source={spendingMetrics[0]?.source?.publisher ?? undefined}
            scope="États modernes entiers"
            method="Donnée non encore intégrée : toujours présenter recettes et dépenses ensemble (un État peut être contributeur ou bénéficiaire net)"
            status={spendingMetrics.length > 0 ? "estimate" : "unverified"}
          />
        </div>
      </section>

      {/* États modernes concernés */}
      <section className="rounded-xl border border-base-surface2 bg-base-surface p-6">
        <h2 className="mb-4 text-base font-semibold">
          États modernes concernés
        </h2>
        <ul className="space-y-3">
          {territory.states.map((s) => (
            <li key={s.id} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.stateName}</span>
                <Badge className={coverageBadgeClass[s.coverageType]}>
                  {coverageLabels[s.coverageType]}
                </Badge>
              </div>
              {s.notes && (
                <p className="mt-0.5 text-xs leading-relaxed text-content-secondary">
                  {s.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Indicateurs détaillés par État */}
      {[...metricsByType.entries()].map(([type, metrics]) => (
        <section
          key={type}
          className="rounded-xl border border-base-surface2 bg-base-surface p-6"
        >
          <h2 className="mb-1 text-base font-semibold">
            {metricTypeLabels[type]} par État
          </h2>
          <p className="mb-4 text-xs text-content-secondary">
            Chaque valeur porte sur l'État moderne entier, pas sur la seule
            partie historiquement acquise.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-base-surface2 text-xs uppercase tracking-wide text-content-secondary">
                  <th className="py-2 pr-4 font-semibold">État</th>
                  <th className="py-2 pr-4 font-semibold">Valeur</th>
                  <th className="py-2 pr-4 font-semibold">Année</th>
                  <th className="py-2 pr-4 font-semibold">Statut</th>
                  <th className="py-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.id} className="border-b border-base-surface2/60">
                    <td className="py-2.5 pr-4 font-medium">
                      {m.stateName ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4">{formatNumber(m.value)}</td>
                    <td className="py-2.5 pr-4">{m.year}</td>
                    <td className="py-2.5 pr-4">
                      {m.needsReview ? (
                        <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-400">
                          À vérifier
                        </Badge>
                      ) : m.isEstimate ? (
                        <Badge className="border-sky-500/40 bg-sky-500/10 text-sky-400">
                          Estimation
                        </Badge>
                      ) : (
                        <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                          Officielle
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 text-xs text-content-secondary">
                      {m.source
                        ? `${m.source.publisher ?? m.source.title}`
                        : "Source à renseigner"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {metrics[0]?.methodology && (
            <p className="mt-3 text-[11px] leading-relaxed text-content-secondary">
              Méthode : {metrics[0].methodology}
            </p>
          )}
        </section>
      ))}

      {territory.needsReview && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-relaxed text-amber-200/80">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            Ce dossier fait partie du contenu initial de démonstration. Les
            indicateurs manquants (PIB, recettes et dépenses fédérales, valeur
            corrigée de l'inflation) sont volontairement laissés à « Donnée à
            vérifier » plutôt que d'afficher des chiffres non sourcés.
          </p>
        </div>
      )}
    </div>
  );
}
