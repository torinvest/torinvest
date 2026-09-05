import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { ConflictsPage } from "./pages/ConflictsPage";
import { ConflictDetailPage } from "./pages/ConflictDetailPage";
import { TerritoriesPage } from "./pages/TerritoriesPage";
import { TerritoryDetailPage } from "./pages/TerritoryDetailPage";
import { ComparePage } from "./pages/ComparePage";
import { SourcesPage } from "./pages/SourcesPage";
import { AdminPage } from "./pages/AdminPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// Chargées à la demande : MapLibre et Recharts sont des dépendances lourdes.
const MapPage = lazy(() =>
  import("./pages/MapPage").then((m) => ({ default: m.MapPage }))
);
const TimelinePage = lazy(() =>
  import("./pages/TimelinePage").then((m) => ({ default: m.TimelinePage }))
);

function PageLoader() {
  return (
    <div className="py-24 text-center text-sm text-content-secondary">
      Chargement…
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/carte"
          element={
            <Suspense fallback={<PageLoader />}>
              <MapPage />
            </Suspense>
          }
        />
        <Route
          path="/chronologie"
          element={
            <Suspense fallback={<PageLoader />}>
              <TimelinePage />
            </Suspense>
          }
        />
        <Route path="/conflits" element={<ConflictsPage />} />
        <Route path="/conflits/:slug" element={<ConflictDetailPage />} />
        <Route path="/territoires" element={<TerritoriesPage />} />
        <Route path="/territoires/:slug" element={<TerritoryDetailPage />} />
        <Route path="/comparateur" element={<ComparePage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
