import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BookOpen,
  GitCompareArrows,
  Globe2,
  History,
  Home,
  Landmark,
  Library,
  Lock,
  Map,
  Menu,
  Swords,
  X,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Accueil", icon: Home, end: true },
  { to: "/carte", label: "Carte", icon: Map, end: false },
  { to: "/chronologie", label: "Chronologie", icon: History, end: false },
  { to: "/conflits", label: "Conflits", icon: Swords, end: false },
  { to: "/territoires", label: "Territoires", icon: Landmark, end: false },
  { to: "/comparateur", label: "Comparateur", icon: GitCompareArrows, end: false },
  { to: "/sources", label: "Sources", icon: Library, end: false },
  { to: "/admin", label: "Administration", icon: Lock, end: false },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-base-surface2 text-content-primary"
                : "text-content-secondary hover:bg-base-surface2/60 hover:text-content-primary"
            }`
          }
        >
          <Icon size={17} strokeWidth={1.8} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Navigation latérale (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-base-surface2 bg-base-surface px-4 py-6 lg:flex">
        <NavLink to="/" className="mb-8 flex items-center gap-2 px-2">
          <Globe2 className="text-category-economic" size={24} strokeWidth={1.6} />
          <div>
            <div className="text-sm font-bold tracking-wide">USA WAR ATLAS</div>
            <div className="text-[11px] text-content-secondary">
              Atlas des interventions américaines
            </div>
          </div>
        </NavLink>
        <NavLinks />
        <div className="mt-auto space-y-2 px-2 text-[11px] leading-relaxed text-content-secondary">
          <p className="flex items-start gap-1.5">
            <BookOpen size={13} className="mt-0.5 shrink-0" />
            Contenu initial de démonstration, en cours de vérification
            éditoriale.
          </p>
          <p className="flex items-start gap-1.5">
            <Landmark size={13} className="mt-0.5 shrink-0" />
            Chaque donnée importante est reliée à une source.
          </p>
        </div>
      </aside>

      {/* En-tête mobile */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-base-surface2 bg-base-surface px-4 py-3 lg:hidden">
        <NavLink to="/" className="flex items-center gap-2">
          <Globe2 className="text-category-economic" size={20} />
          <span className="text-sm font-bold tracking-wide">USA WAR ATLAS</span>
        </NavLink>
        <button
          type="button"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-1.5 text-content-secondary hover:bg-base-surface2"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Menu mobile déroulant */}
      {mobileOpen && (
        <div className="fixed inset-x-0 top-12 z-20 border-b border-base-surface2 bg-base-surface p-4 lg:hidden">
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-16 pt-16 lg:ml-60 lg:px-10 lg:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
