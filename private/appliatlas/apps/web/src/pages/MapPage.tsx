import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { ConflictGeoDto, InterventionCategory } from "@usa-war-atlas/shared";
import { INTERVENTION_CATEGORIES } from "@usa-war-atlas/shared";
import { getConflictsGeo } from "../lib/api";
import {
  categoryHexColor,
  categoryLabel,
  formatYearRange,
} from "../lib/categories";

/** Fond de carte sombre (tuiles raster CARTO, gratuites avec attribution). */
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

const MULTI_COLOR = "#F9FAFB";

interface Filters {
  category: "" | InterventionCategory;
  region: string;
  startYear: string;
  endYear: string;
  status: "" | "ongoing" | "ended";
  covert: "" | "covert" | "open";
}

const EMPTY_FILTERS: Filters = {
  category: "",
  region: "",
  startYear: "",
  endYear: "",
  status: "",
  covert: "",
};

interface CountryGroup {
  name: string;
  iso3: string;
  latitude: number;
  longitude: number;
  conflicts: ConflictGeoDto[];
}

/** Regroupe les conflits filtrés par pays localisable. */
function groupByCountry(conflicts: ConflictGeoDto[]): CountryGroup[] {
  const groups = new Map<string, CountryGroup>();
  for (const conflict of conflicts) {
    for (const cc of conflict.countries) {
      const { name, iso3, latitude, longitude } = cc.country;
      if (latitude == null || longitude == null) continue;
      let group = groups.get(iso3);
      if (!group) {
        group = { name, iso3, latitude, longitude, conflicts: [] };
        groups.set(iso3, group);
      }
      if (!group.conflicts.some((c) => c.id === conflict.id)) {
        group.conflicts.push(conflict);
      }
    }
  }
  return [...groups.values()];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Contenu HTML du popup (MapLibre ne rend pas de composants React). */
function popupHtml(group: CountryGroup): string {
  const items = group.conflicts
    .map((c) => {
      const color = categoryHexColor[c.primaryCategory];
      const years = formatYearRange(c.startDate, c.endDate, c.isOngoing);
      return `<li style="margin-top:8px">
        <a href="/conflits/${encodeURIComponent(c.slug)}"
           style="color:#F9FAFB;font-weight:600;text-decoration:underline;text-underline-offset:2px">
          ${escapeHtml(c.title)}
        </a>
        <div style="margin-top:2px;font-size:11px;color:#9CA3AF">
          <span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:${color};margin-right:5px"></span>
          ${escapeHtml(categoryLabel(c.primaryCategory))} · ${escapeHtml(years)}
        </div>
      </li>`;
    })
    .join("");
  return `<div style="font-family:inherit;min-width:220px;max-width:280px">
    <div style="font-size:13px;font-weight:700;color:#F9FAFB">${escapeHtml(group.name)}</div>
    <div style="font-size:11px;color:#9CA3AF">${group.conflicts.length} conflit(s) documenté(s)</div>
    <ul style="list-style:none;margin:0;padding:0">${items}</ul>
  </div>`;
}

export function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [conflicts, setConflicts] = useState<ConflictGeoDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [countrySearch, setCountrySearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);

  // Chargement des données
  useEffect(() => {
    getConflictsGeo()
      .then((res) => setConflicts(res.data))
      .catch((e: Error) => setError(e.message));
  }, []);

  // Initialisation de la carte
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-30, 25],
      zoom: 1.6,
      minZoom: 1,
      maxZoom: 10,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const regions = useMemo(
    () => [...new Set(conflicts.map((c) => c.region))].sort(),
    [conflicts]
  );

  const filtered = useMemo(() => {
    return conflicts.filter((c) => {
      if (filters.category && c.primaryCategory !== filters.category) {
        return false;
      }
      if (filters.region && c.region !== filters.region) return false;
      const startYear = new Date(c.startDate).getFullYear();
      if (filters.startYear && startYear < Number(filters.startYear)) {
        return false;
      }
      if (filters.endYear && startYear > Number(filters.endYear)) return false;
      if (filters.status === "ongoing" && !c.isOngoing) return false;
      if (filters.status === "ended" && c.isOngoing) return false;
      if (filters.covert === "covert" && !c.hasCovert) return false;
      if (filters.covert === "open" && c.hasCovert) return false;
      return true;
    });
  }, [conflicts, filters]);

  const groups = useMemo(() => groupByCountry(filtered), [filtered]);

  // (Re)création des marqueurs quand les filtres changent
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const group of groups) {
      const categories = new Set(
        group.conflicts.map((c) => c.primaryCategory)
      );
      const color =
        categories.size === 1
          ? categoryHexColor[[...categories][0]]
          : MULTI_COLOR;
      const size = Math.min(30, 14 + group.conflicts.length * 3);

      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute(
        "aria-label",
        `${group.name} : ${group.conflicts.length} conflit(s)`
      );
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;cursor:pointer;
        background:${color}33;border:2px solid ${color};box-shadow:0 0 10px ${color}55;`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([group.longitude, group.latitude])
        .setPopup(
          new maplibregl.Popup({
            offset: 14,
            closeButton: true,
            maxWidth: "300px",
          }).setHTML(popupHtml(group))
        )
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [groups]);

  // Recherche de pays : vol vers le premier pays correspondant
  const handleCountrySearch = (e: React.FormEvent) => {
    e.preventDefault();
    const map = mapRef.current;
    const term = countrySearch.trim().toLowerCase();
    if (!map || !term) return;
    const match = groups.find(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        g.iso3.toLowerCase() === term
    );
    if (match) {
      map.flyTo({
        center: [match.longitude, match.latitude],
        zoom: 4,
        duration: 1200,
      });
    }
  };

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  const selectClass =
    "w-full rounded-lg border border-base-surface2 bg-base-surface px-2.5 py-1.5 text-sm focus:border-content-secondary/50 focus:outline-none";

  return (
    <div className="relative -mx-4 -mb-16 -mt-16 h-screen lg:-mx-10 lg:-mt-8 lg:h-[calc(100vh)]">
      {/* Carte plein cadre */}
      <div ref={containerRef} className="h-full w-full" />

      {error && (
        <div className="absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-lg border border-red-500/40 bg-base-surface p-4 text-sm text-red-300">
          Erreur de chargement : {error}
        </div>
      )}

      {/* Panneau filtres */}
      <div className="absolute left-3 top-16 z-10 w-72 max-w-[calc(100vw-24px)] lg:top-6">
        <div className="rounded-xl border border-base-surface2 bg-base-surface/95 shadow-xl backdrop-blur">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal size={15} />
              Filtres
            </span>
            <span className="text-xs font-normal text-content-secondary">
              {filtered.length} conflit(s)
            </span>
          </button>

          {panelOpen && (
            <div className="space-y-3 border-t border-base-surface2 p-4">
              <form onSubmit={handleCountrySearch} className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-secondary"
                />
                <input
                  type="search"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Aller à un pays… (Entrée)"
                  className="w-full rounded-lg border border-base-surface2 bg-base-bg py-1.5 pl-8 pr-2.5 text-sm placeholder:text-content-secondary focus:border-content-secondary/50 focus:outline-none"
                />
              </form>

              <select
                value={filters.category}
                onChange={(e) =>
                  updateFilter(
                    "category",
                    e.target.value as Filters["category"]
                  )
                }
                className={selectClass}
              >
                <option value="">Toutes les catégories</option>
                {INTERVENTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>

              <select
                value={filters.region}
                onChange={(e) => updateFilter("region", e.target.value)}
                className={selectClass}
              >
                <option value="">Toutes les régions</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="De (année)"
                  value={filters.startYear}
                  onChange={(e) => updateFilter("startYear", e.target.value)}
                  className={selectClass}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="À (année)"
                  value={filters.endYear}
                  onChange={(e) => updateFilter("endYear", e.target.value)}
                  className={selectClass}
                />
              </div>

              <select
                value={filters.status}
                onChange={(e) =>
                  updateFilter("status", e.target.value as Filters["status"])
                }
                className={selectClass}
              >
                <option value="">Terminés et en cours</option>
                <option value="ongoing">En cours uniquement</option>
                <option value="ended">Terminés uniquement</option>
              </select>

              <select
                value={filters.covert}
                onChange={(e) =>
                  updateFilter("covert", e.target.value as Filters["covert"])
                }
                className={selectClass}
              >
                <option value="">Ouvertes et clandestines</option>
                <option value="covert">Avec volet clandestin</option>
                <option value="open">Sans volet clandestin</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="inline-flex items-center gap-1.5 text-xs text-content-secondary hover:text-content-primary"
                >
                  <X size={13} /> Réinitialiser les filtres
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Légende */}
      <div className="absolute bottom-6 left-3 z-10 rounded-xl border border-base-surface2 bg-base-surface/95 p-4 shadow-xl backdrop-blur">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-secondary">
          Légende
        </div>
        <ul className="space-y-1.5">
          {INTERVENTION_CATEGORIES.map((c) => (
            <li key={c} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border"
                style={{
                  backgroundColor: `${categoryHexColor[c]}55`,
                  borderColor: categoryHexColor[c],
                }}
              />
              {categoryLabel(c)}
            </li>
          ))}
          <li className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border"
              style={{
                backgroundColor: `${MULTI_COLOR}33`,
                borderColor: MULTI_COLOR,
              }}
            />
            Catégories multiples
          </li>
        </ul>
      </div>
    </div>
  );
}
