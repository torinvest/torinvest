import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  ShieldQuestion,
  Trash2,
  Upload,
} from "lucide-react";
import type { ConflictListItemDto } from "@usa-war-atlas/shared";
import {
  CERTAINTY_LEVELS,
  INTERVENTION_CATEGORIES,
  REGIONS,
} from "@usa-war-atlas/shared";
import { getConflicts } from "../lib/api";
import {
  adminApi,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from "../lib/admin-api";
import { Badge } from "../components/Badge";
import {
  categoryBadgeClass,
  categoryLabel,
  certaintyBadgeClass,
  certaintyLabel,
  formatYearRange,
} from "../lib/categories";

type Tab = "conflicts" | "newConflict" | "newSource" | "importExport";

const inputClass =
  "w-full rounded-lg border border-base-surface2 bg-base-bg px-3 py-2 text-sm placeholder:text-content-secondary focus:border-content-secondary/50 focus:outline-none";
const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-content-secondary";
const buttonClass =
  "inline-flex items-center gap-2 rounded-lg bg-content-primary px-4 py-2 text-sm font-semibold text-base-bg transition-opacity hover:opacity-90 disabled:opacity-40";
const secondaryButtonClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-base-surface2 bg-base-surface px-3 py-1.5 text-xs transition-colors hover:border-content-secondary/40 disabled:opacity-40";

function Feedback({
  message,
  type,
}: {
  message: string | null;
  type: "success" | "error";
}) {
  if (!message) return null;
  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        type === "success"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/40 bg-red-500/10 text-red-300"
      }`}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(null);
    setAdminToken(token.trim());
    try {
      await adminApi.verifyToken();
      onSuccess();
    } catch (err) {
      clearAdminToken();
      setError(err instanceof Error ? err.message : "Jeton invalide");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm pt-20">
      <div className="rounded-xl border border-base-surface2 bg-base-surface p-6">
        <KeyRound size={24} className="mb-3 text-content-secondary" />
        <h1 className="text-xl font-bold">Espace administrateur</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Saisissez le jeton défini dans la variable d'environnement
          ADMIN_TOKEN de l'API.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Jeton administrateur"
            className={inputClass}
            autoFocus
          />
          <Feedback message={error} type="error" />
          <button type="submit" disabled={!token.trim() || checking} className={buttonClass}>
            {checking ? "Vérification…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet : liste des conflits (marquage éditorial)
// ---------------------------------------------------------------------------

function ConflictsTab() {
  const [conflicts, setConflicts] = useState<ConflictListItemDto[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    getConflicts({ limit: 100, sort: "startDate" })
      .then((res) => setConflicts(res.data))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(reload, [reload]);

  const act = async (id: string, action: () => Promise<unknown>, label: string) => {
    setBusy(id);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(label);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Feedback message={message} type="success" />
      <Feedback message={error} type="error" />
      {conflicts.map((c) => (
        <div
          key={c.id}
          className="rounded-xl border border-base-surface2 bg-base-surface p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{c.title}</span>
            <span className="text-xs text-content-secondary">
              {formatYearRange(c.startDate, c.endDate, c.isOngoing)}
            </span>
            <Badge className={categoryBadgeClass[c.primaryCategory]}>
              {categoryLabel(c.primaryCategory)}
            </Badge>
            <Badge className={certaintyBadgeClass[c.certaintyLevel]}>
              {certaintyLabel(c.certaintyLevel)}
            </Badge>
            {c.needsReview ? (
              <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-400">
                À revoir
              </Badge>
            ) : (
              <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                Vérifié
              </Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === c.id}
              onClick={() =>
                act(
                  c.id,
                  () =>
                    adminApi.updateConflict(c.id, {
                      verified: true,
                      needsReview: false,
                    }),
                  `« ${c.title} » marqué comme vérifié`
                )
              }
              className={secondaryButtonClass}
            >
              <CheckCircle2 size={13} /> Marquer vérifié
            </button>
            <button
              type="button"
              disabled={busy === c.id}
              onClick={() =>
                act(
                  c.id,
                  () =>
                    adminApi.updateConflict(c.id, {
                      verified: false,
                      needsReview: true,
                    }),
                  `« ${c.title} » marqué à revoir`
                )
              }
              className={secondaryButtonClass}
            >
              <RefreshCw size={13} /> Marquer à revoir
            </button>
            <button
              type="button"
              disabled={busy === c.id}
              onClick={() =>
                act(
                  c.id,
                  () =>
                    adminApi.updateConflict(c.id, {
                      certaintyLevel: "DISPUTED",
                    }),
                  `« ${c.title} » marqué comme débattu`
                )
              }
              className={secondaryButtonClass}
            >
              <ShieldQuestion size={13} /> Marquer débattu
            </button>
            <button
              type="button"
              disabled={busy === c.id}
              onClick={() => {
                if (
                  window.confirm(
                    `Supprimer définitivement « ${c.title} » et toutes ses données liées ?`
                  )
                ) {
                  void act(
                    c.id,
                    () => adminApi.deleteConflict(c.id),
                    `« ${c.title} » supprimé`
                  );
                }
              }}
              className={`${secondaryButtonClass} text-red-400 hover:border-red-500/40`}
            >
              <Trash2 size={13} /> Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet : nouveau conflit
// ---------------------------------------------------------------------------

function NewConflictTab() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    title: "",
    summary: "",
    startDate: "",
    endDate: "",
    isOngoing: false,
    region: "",
    primaryCategory: "",
    certaintyLevel: "ESTABLISHED",
  });

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await adminApi.createConflict({
        slug: form.slug,
        title: form.title,
        summary: form.summary,
        startDate: form.startDate,
        endDate: form.endDate || null,
        isOngoing: form.isOngoing,
        region: form.region,
        primaryCategory: form.primaryCategory,
        certaintyLevel: form.certaintyLevel,
        needsReview: true,
      });
      setMessage(
        `Conflit « ${form.title} » créé (marqué « à revoir » par défaut).`
      );
      setForm({
        slug: "",
        title: "",
        summary: "",
        startDate: "",
        endDate: "",
        isOngoing: false,
        region: "",
        primaryCategory: "",
        certaintyLevel: "ESTABLISHED",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <Feedback message={message} type="success" />
      <Feedback message={error} type="error" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Titre *</label>
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Slug * (kebab-case)</label>
          <input
            value={form.slug}
            onChange={(e) => update("slug", e.target.value)}
            className={inputClass}
            placeholder="guerre-de-coree"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Résumé *</label>
        <textarea
          value={form.summary}
          onChange={(e) => update("summary", e.target.value)}
          className={`${inputClass} min-h-24`}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Date de début *</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => update("startDate", e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Date de fin</label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => update("endDate", e.target.value)}
            className={inputClass}
          />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={form.isOngoing}
            onChange={(e) => update("isOngoing", e.target.checked)}
            className="h-4 w-4"
          />
          Conflit en cours
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Région *</label>
          <select
            value={form.region}
            onChange={(e) => update("region", e.target.value)}
            className={inputClass}
            required
          >
            <option value="">— Choisir —</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Catégorie *</label>
          <select
            value={form.primaryCategory}
            onChange={(e) => update("primaryCategory", e.target.value)}
            className={inputClass}
            required
          >
            <option value="">— Choisir —</option>
            {INTERVENTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Niveau de certitude</label>
          <select
            value={form.certaintyLevel}
            onChange={(e) => update("certaintyLevel", e.target.value)}
            className={inputClass}
          >
            {CERTAINTY_LEVELS.map((c) => (
              <option key={c} value={c}>
                {certaintyLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button type="submit" disabled={saving} className={buttonClass}>
        <Plus size={15} />
        {saving ? "Création…" : "Créer le conflit"}
      </button>
      <p className="text-xs text-content-secondary">
        Les champs détaillés (justification officielle, résultats,
        conséquences, pays, chronologie, sources) s'ajoutent ensuite via
        l'API ou une prochaine version de cet espace.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Onglet : nouvelle source
// ---------------------------------------------------------------------------

function NewSourceTab() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    publisher: "",
    url: "",
    sourceType: "GOVERNMENT",
    reliabilityLevel: "HIGH",
    notes: "",
  });

  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await adminApi.createSource({
        title: form.title,
        publisher: form.publisher || null,
        url: form.url || null,
        sourceType: form.sourceType,
        reliabilityLevel: form.reliabilityLevel,
        notes: form.notes || null,
      });
      setMessage(`Source « ${form.title} » créée.`);
      setForm({
        title: "",
        publisher: "",
        url: "",
        sourceType: "GOVERNMENT",
        reliabilityLevel: "HIGH",
        notes: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <Feedback message={message} type="success" />
      <Feedback message={error} type="error" />
      <div>
        <label className={labelClass}>Titre *</label>
        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Organisme</label>
          <input
            value={form.publisher}
            onChange={(e) => update("publisher", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>URL</label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => update("url", e.target.value)}
            className={inputClass}
            placeholder="https://…"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Type</label>
          <select
            value={form.sourceType}
            onChange={(e) => update("sourceType", e.target.value)}
            className={inputClass}
          >
            <option value="GOVERNMENT">Gouvernement</option>
            <option value="ACADEMIC">Académique</option>
            <option value="INTERNATIONAL_ORGANIZATION">
              Organisation internationale
            </option>
            <option value="BOOK">Livre</option>
            <option value="PRESS">Presse</option>
            <option value="DATABASE">Base de données</option>
            <option value="ARCHIVE">Archives</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Fiabilité</label>
          <select
            value={form.reliabilityLevel}
            onChange={(e) => update("reliabilityLevel", e.target.value)}
            className={inputClass}
          >
            <option value="HIGH">Élevée</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="LOW">Faible</option>
            <option value="CONTESTED">Contestée</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes / synthèse rédigée</label>
        <textarea
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          className={`${inputClass} min-h-24`}
        />
      </div>
      <button type="submit" disabled={saving} className={buttonClass}>
        <Plus size={15} />
        {saving ? "Création…" : "Créer la source"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Onglet : import / export
// ---------------------------------------------------------------------------

function ImportExportTab() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState("");

  const doExport = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await adminApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `usa-war-atlas-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Export téléchargé.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const parsed = JSON.parse(importText);
      const conflicts = Array.isArray(parsed) ? parsed : parsed.conflicts;
      if (!Array.isArray(conflicts)) {
        throw new Error(
          "Format attendu : un tableau de conflits, ou un objet { conflicts: [...] }"
        );
      }
      const result = await adminApi.importConflicts(conflicts);
      setMessage(
        `Import terminé : ${result.created} créé(s), ${result.updated} mis à jour (tous marqués « à revoir »).`
      );
      setImportText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "JSON invalide");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Feedback message={message} type="success" />
      <Feedback message={error} type="error" />

      <section className="rounded-xl border border-base-surface2 bg-base-surface p-5">
        <h2 className="font-semibold">Exporter les données</h2>
        <p className="mt-1 text-sm text-content-secondary">
          Télécharge un fichier JSON complet : conflits (avec relations), pays,
          sources, territoires et notes d'administration.
        </p>
        <button
          type="button"
          onClick={doExport}
          disabled={busy}
          className={`${buttonClass} mt-3`}
        >
          <Download size={15} /> Exporter en JSON
        </button>
      </section>

      <section className="rounded-xl border border-base-surface2 bg-base-surface p-5">
        <h2 className="font-semibold">Importer des conflits</h2>
        <p className="mt-1 text-sm text-content-secondary">
          Collez un tableau JSON de conflits (champs simples, au format du
          schéma de création). Les slugs existants sont mis à jour, les autres
          créés ; tout est marqué « à revoir ».
        </p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='[{ "slug": "guerre-de-coree", "title": "Guerre de Corée", ... }]'
          className={`${inputClass} mt-3 min-h-40 font-mono text-xs`}
        />
        <button
          type="button"
          onClick={doImport}
          disabled={busy || !importText.trim()}
          className={`${buttonClass} mt-3`}
        >
          <Upload size={15} /> Importer
        </button>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "conflicts", label: "Conflits" },
  { id: "newConflict", label: "Nouveau conflit" },
  { id: "newSource", label: "Nouvelle source" },
  { id: "importExport", label: "Import / Export" },
];

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(!!getAdminToken());
  const [tab, setTab] = useState<Tab>("conflicts");

  if (!authenticated) {
    return <LoginForm onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="mt-1 text-sm text-content-secondary">
            Gestion éditoriale du contenu : création, marquage
            vérifié/débattu, import et export.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearAdminToken();
            setAuthenticated(false);
          }}
          className={secondaryButtonClass}
        >
          <LogOut size={13} /> Se déconnecter
        </button>
      </header>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200/80">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <p>
          Espace MVP protégé par jeton (variable ADMIN_TOKEN). À remplacer par
          une authentification complète avant toute mise en production
          multi-utilisateurs.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-base-surface2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2 text-sm transition-colors ${
              tab === t.id
                ? "border border-b-0 border-base-surface2 bg-base-surface font-semibold"
                : "text-content-secondary hover:text-content-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "conflicts" && <ConflictsTab />}
      {tab === "newConflict" && <NewConflictTab />}
      {tab === "newSource" && <NewSourceTab />}
      {tab === "importExport" && <ImportExportTab />}
    </div>
  );
}
