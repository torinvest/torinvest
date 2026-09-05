import type { ReactNode } from "react";
import { Badge } from "./Badge";

/**
 * Bloc statistique conforme aux règles éditoriales : chaque chiffre affiche
 * l'année, la source, le périmètre, la méthode et son statut
 * (donnée officielle / estimation / donnée à vérifier).
 */
export function StatBlock({
  label,
  value,
  year,
  source,
  scope,
  method,
  status,
  icon,
}: {
  label: string;
  value: string | null;
  year?: number | string | null;
  source?: string | null;
  scope?: string | null;
  method?: string | null;
  status: "official" | "estimate" | "unverified";
  icon?: ReactNode;
}) {
  const statusBadge = {
    official: (
      <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
        Donnée officielle
      </Badge>
    ),
    estimate: (
      <Badge className="border-sky-500/40 bg-sky-500/10 text-sky-400">
        Estimation
      </Badge>
    ),
    unverified: (
      <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-400">
        Donnée à vérifier
      </Badge>
    ),
  }[status];

  return (
    <div className="flex flex-col rounded-xl border border-base-surface2 bg-base-surface p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-content-secondary">
        {icon}
        {label}
        {year != null && <span className="font-normal normal-case">({year})</span>}
      </div>
      <div className="mt-2 text-xl font-bold leading-tight">
        {value ?? <span className="italic text-content-secondary">Donnée à vérifier</span>}
      </div>
      <div className="mt-2">{statusBadge}</div>
      <dl className="mt-3 space-y-1 text-[11px] leading-relaxed text-content-secondary">
        {source && (
          <div>
            <dt className="inline font-semibold">Source : </dt>
            <dd className="inline">{source}</dd>
          </div>
        )}
        {scope && (
          <div>
            <dt className="inline font-semibold">Périmètre : </dt>
            <dd className="inline">{scope}</dd>
          </div>
        )}
        {method && (
          <div>
            <dt className="inline font-semibold">Méthode : </dt>
            <dd className="inline">{method}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
