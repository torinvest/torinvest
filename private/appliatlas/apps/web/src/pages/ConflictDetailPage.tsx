import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  ExternalLink,
  Flag,
  Landmark,
  MapPin,
  Scale,
  Users,
} from "lucide-react";
import type { ConflictDetailDto } from "@usa-war-atlas/shared";
import { getConflict } from "../lib/api";
import { Badge } from "../components/Badge";
import {
  categoryBadgeClass,
  categoryLabel,
  certaintyBadgeClass,
  certaintyLabel,
  formatDate,
  formatYearRange,
} from "../lib/categories";

function Section({
  title,
  children,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <section className="rounded-xl border border-base-surface2 bg-base-surface p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && (
          <span className="text-[11px] uppercase tracking-wide text-content-secondary">
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Prose({ text }: { text: string | null }) {
  if (!text) {
    return (
      <p className="text-sm italic text-content-secondary">Donnée à vérifier</p>
    );
  }
  return (
    <p className="whitespace-pre-line text-sm leading-relaxed text-content-secondary">
      {text}
    </p>
  );
}

const roleLabels: Record<string, string> = {
  BELLIGERENT: "Belligérant",
  ALLY: "Allié",
  SUPPORTED_FORCE: "Force soutenue",
  TARGET: "Cible",
  HOST_COUNTRY: "Pays hôte",
  MEDIATOR: "Médiateur",
};

function formatCasualtyRange(e: {
  minimumValue: number | null;
  maximumValue: number | null;
  bestEstimate: number | null;
}): string {
  const fmt = (n: number) => n.toLocaleString("fr-FR");
  if (e.bestEstimate != null) return fmt(e.bestEstimate);
  if (e.minimumValue != null && e.maximumValue != null) {
    return e.minimumValue === e.maximumValue
      ? fmt(e.minimumValue)
      : `${fmt(e.minimumValue)} – ${fmt(e.maximumValue)}`;
  }
  if (e.minimumValue != null) return `≥ ${fmt(e.minimumValue)}`;
  return "Donnée à vérifier";
}

export function ConflictDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [conflict, setConflict] = useState<ConflictDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    getConflict(slug)
      .then((res) => setConflict(res.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="py-24 text-center text-sm text-content-secondary">
        Chargement…
      </div>
    );
  }

  if (error || !conflict) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pt-10">
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error ?? "Conflit introuvable"}
        </div>
        <Link
          to="/conflits"
          className="inline-flex items-center gap-2 text-sm text-content-secondary hover:text-content-primary"
        >
          <ArrowLeft size={15} /> Retour à la liste des conflits
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/conflits"
        className="inline-flex items-center gap-2 pt-2 text-sm text-content-secondary hover:text-content-primary"
      >
        <ArrowLeft size={15} /> Tous les conflits
      </Link>

      {/* En-tête */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={categoryBadgeClass[conflict.primaryCategory]}>
            {categoryLabel(conflict.primaryCategory)}
          </Badge>
          <Badge className={certaintyBadgeClass[conflict.certaintyLevel]}>
            {certaintyLabel(conflict.certaintyLevel)}
          </Badge>
          {conflict.isOngoing && (
            <Badge className="border-red-500/40 bg-red-500/10 text-red-400">
              En cours
            </Badge>
          )}
          {conflict.needsReview && (
            <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-400">
              <AlertTriangle size={11} /> Contenu à vérifier
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
          {conflict.title}
        </h1>
        <div className="flex flex-wrap gap-5 text-sm text-content-secondary">
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange size={15} />
            {formatYearRange(
              conflict.startDate,
              conflict.endDate,
              conflict.isOngoing
            )}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={15} />
            {conflict.region}
          </span>
        </div>
        <p className="leading-relaxed text-content-secondary">
          {conflict.summary}
        </p>
      </header>

      {/* Pays impliqués */}
      <Section title="Pays impliqués">
        <ul className="space-y-3">
          {conflict.countries.map((cc) => (
            <li key={cc.id} className="flex items-start gap-3 text-sm">
              <Flag size={15} className="mt-0.5 shrink-0 text-content-secondary" />
              <div>
                <span className="font-medium">{cc.country.name}</span>
                <span className="ml-2 text-xs text-content-secondary">
                  {roleLabels[cc.role] ?? cc.role}
                  {cc.side ? ` · ${cc.side}` : ""}
                </span>
                {cc.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-content-secondary">
                    {cc.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Contexte et justification */}
      <Section title="Contexte stratégique" hint="Analyse historique">
        <Prose text={conflict.strategicContext} />
      </Section>

      <Section title="Justification officielle" hint="Justification officielle">
        <p className="mb-3 text-xs italic text-content-secondary">
          Les justifications officielles sont présentées comme telles ; elles
          ne constituent pas des faits établis.
        </p>
        <Prose text={conflict.officialJustification} />
      </Section>

      <Section title="Base juridique">
        <div className="flex items-start gap-3">
          <Scale size={15} className="mt-1 shrink-0 text-content-secondary" />
          <Prose text={conflict.legalBasis} />
        </div>
      </Section>

      {/* Chronologie */}
      {conflict.timelineEvents.length > 0 && (
        <Section title="Chronologie">
          <ol className="relative space-y-5 border-l border-base-surface2 pl-5">
            {conflict.timelineEvents.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-content-secondary" />
                <div className="text-xs font-medium uppercase tracking-wide text-content-secondary">
                  {formatDate(e.date)}
                </div>
                <div className="mt-0.5 text-sm font-medium">{e.title}</div>
                {e.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-content-secondary">
                    {e.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Résultats */}
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Résultat militaire">
          <Prose text={conflict.militaryResult} />
        </Section>
        <Section title="Résultat politique">
          <Prose text={conflict.politicalResult} />
        </Section>
      </div>

      {/* Conséquences */}
      <Section title="Conséquences humaines">
        <Prose text={conflict.humanConsequences} />
        {conflict.casualtyEstimates.length > 0 && (
          <div className="mt-5 space-y-3">
            {conflict.casualtyEstimates.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border border-base-surface2 bg-base-surface2/40 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Users size={14} className="text-content-secondary" />
                  <span className="text-sm font-semibold">
                    {formatCasualtyRange(e)}
                  </span>
                  {e.needsReview ? (
                    <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-400">
                      Estimation à vérifier
                    </Badge>
                  ) : (
                    <Badge className="border-sky-500/40 bg-sky-500/10 text-sky-400">
                      Estimation sourcée
                    </Badge>
                  )}
                </div>
                {e.description && (
                  <p className="mt-2 text-xs leading-relaxed text-content-secondary">
                    {e.description}
                  </p>
                )}
                {e.source && (
                  <p className="mt-1.5 text-xs text-content-secondary">
                    Source : {e.source.title}
                    {e.source.publisher ? ` — ${e.source.publisher}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Conséquences économiques">
        <Prose text={conflict.economicConsequences} />
      </Section>

      <Section title="Conséquences territoriales">
        <div className="flex items-start gap-3">
          <Landmark size={15} className="mt-1 shrink-0 text-content-secondary" />
          <Prose text={conflict.territorialConsequences} />
        </div>
        {conflict.territories.length > 0 && (
          <div className="mt-4 space-y-3">
            {conflict.territories.map((t) => (
              <Link
                key={t.id}
                to={`/territoires/${t.slug}`}
                className="group flex flex-col gap-1 rounded-lg border border-base-surface2 bg-base-surface2/40 p-4 transition-colors hover:border-content-secondary/40"
              >
                <span className="text-sm font-semibold group-hover:underline">
                  {t.name}
                </span>
                <span className="text-xs text-content-secondary">
                  {t.treatyName ? `${t.treatyName} · ` : ""}
                  {t.areaKm2
                    ? `≈ ${Math.round(t.areaKm2).toLocaleString("fr-FR")} km² · `
                    : ""}
                  {t.originalPrice != null
                    ? `${t.originalPrice.toLocaleString("fr-FR")} $ (nominal)`
                    : ""}
                </span>
                <span className="text-xs text-content-secondary underline underline-offset-2">
                  Voir le dossier territorial complet (États concernés,
                  indicateurs, méthodologie)
                </span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* Interventions */}
      {conflict.interventions.length > 0 && (
        <Section title="Interventions et opérations">
          <div className="space-y-4">
            {conflict.interventions.map((i) => (
              <div
                key={i.id}
                className="rounded-lg border border-base-surface2 bg-base-surface2/40 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={categoryBadgeClass[i.type]}>
                    {categoryLabel(i.type)}
                  </Badge>
                  {i.isCovert && (
                    <Badge className={certaintyBadgeClass.INTERPRETATION}>
                      Clandestine
                    </Badge>
                  )}
                  <Badge className={certaintyBadgeClass[i.certaintyLevel]}>
                    {certaintyLabel(i.certaintyLevel)}
                  </Badge>
                </div>
                <div className="mt-2 text-sm font-medium">{i.title}</div>
                {i.description && (
                  <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                    {i.description}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-content-secondary">
                  {i.startDate ? formatDate(i.startDate) : "?"} —{" "}
                  {i.endDate ? formatDate(i.endDate) : "?"}
                  {i.agency ? ` · ${i.agency}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Sources */}
      <Section title="Sources">
        {conflict.sources.length === 0 ? (
          <p className="text-sm italic text-content-secondary">
            Aucune source référencée pour l'instant.
          </p>
        ) : (
          <ul className="space-y-3">
            {conflict.sources.map(({ source, usageDescription }) => (
              <li key={source.id} className="text-sm">
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium underline decoration-content-secondary/40 underline-offset-2 hover:decoration-content-primary"
                  >
                    {source.title}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="font-medium">{source.title}</span>
                )}
                <span className="ml-2 text-xs text-content-secondary">
                  {source.publisher}
                </span>
                {usageDescription && (
                  <p className="mt-0.5 text-xs leading-relaxed text-content-secondary">
                    {usageDescription}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {conflict.needsReview && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-relaxed text-amber-200/80">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            Ce dossier fait partie du contenu initial de démonstration et n'a
            pas encore fait l'objet d'une relecture éditoriale complète.
            Certaines données sont volontairement laissées à « Donnée à
            vérifier » plutôt que d'afficher des chiffres non sourcés.
          </p>
        </div>
      )}
    </div>
  );
}
