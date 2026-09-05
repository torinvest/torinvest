import { Link } from "react-router-dom";
import { CalendarRange, MapPin } from "lucide-react";
import type { ConflictListItemDto } from "@usa-war-atlas/shared";
import { Badge } from "./Badge";
import {
  categoryBadgeClass,
  categoryLabel,
  formatYearRange,
} from "../lib/categories";

export function ConflictCard({ conflict }: { conflict: ConflictListItemDto }) {
  return (
    <Link
      to={`/conflits/${conflict.slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-base-surface2 bg-base-surface p-5 transition-colors hover:border-content-secondary/40"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={categoryBadgeClass[conflict.primaryCategory]}>
          {categoryLabel(conflict.primaryCategory)}
        </Badge>
        {conflict.isOngoing && (
          <Badge className="border-red-500/40 bg-red-500/10 text-red-400">
            En cours
          </Badge>
        )}
      </div>
      <h3 className="text-lg font-semibold leading-snug group-hover:underline">
        {conflict.title}
      </h3>
      <p className="line-clamp-3 text-sm leading-relaxed text-content-secondary">
        {conflict.summary}
      </p>
      <div className="mt-auto flex flex-wrap gap-4 text-xs text-content-secondary">
        <span className="inline-flex items-center gap-1.5">
          <CalendarRange size={13} />
          {formatYearRange(
            conflict.startDate,
            conflict.endDate,
            conflict.isOngoing
          )}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={13} />
          {conflict.region}
        </span>
      </div>
    </Link>
  );
}
