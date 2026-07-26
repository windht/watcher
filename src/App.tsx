import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo } from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { Shell } from "./components/shell";
import { I18nProvider } from "./i18n";
import { Skeleton } from "./components/ui";
import { WorkspaceProvider, useSnapshotQuery } from "./workspace-context";
import { WatcherAssistant } from "./assistant/watcher-assistant";

const RequestsPage = lazy(() => import("./pages/requests").then((module) => ({ default: module.RequestsPage })));
const EnvironmentPage = lazy(() => import("./pages/environments").then((module) => ({ default: module.EnvironmentPage })));
const HistoryPage = lazy(() => import("./pages/history").then((module) => ({ default: module.HistoryPage })));
const McpPage = lazy(() => import("./pages/mcp").then((module) => ({ default: module.McpPage })));
const SettingsPage = lazy(() => import("./pages/settings").then((module) => ({ default: module.SettingsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

function AppRoutes() {
  const snapshotQuery = useSnapshotQuery();
  const snapshot = snapshotQuery.data;

  useEffect(() => {
    if (!snapshot) return;
    const resolveTheme = () => {
      const dark =
        snapshot.settings.theme === "dark" ||
        (snapshot.settings.theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.lang = snapshot.settings.language;
    };
    resolveTheme();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", resolveTheme);
    return () => media.removeEventListener("change", resolveTheme);
  }, [snapshot]);

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["snapshot"] });
    window.addEventListener("watcher:data-changed", refresh);
    return () => window.removeEventListener("watcher:data-changed", refresh);
  }, []);

  if (snapshotQuery.isLoading) {
    return (
      <div className="app-loading">
        <div><Skeleton style={{ height: 34 }} /></div>
        <div><Skeleton style={{ height: 36, marginBottom: 16 }} /><Skeleton style={{ height: 240 }} /></div>
        <div><Skeleton style={{ height: 38, marginBottom: 14 }} /><Skeleton style={{ height: "70%" }} /></div>
      </div>
    );
  }

  if (!snapshot || snapshotQuery.isError) {
    return (
      <div className="empty-state">
        <h2>Watcher could not open its local database.</h2>
        <p>{snapshotQuery.error instanceof Error ? snapshotQuery.error.message : "Unknown startup error"}</p>
        <button className="button button-secondary button-default" onClick={() => snapshotQuery.refetch()}>Try again</button>
      </div>
    );
  }

  return (
    <I18nProvider language={snapshot.settings.language}>
      <WorkspaceProvider snapshot={snapshot}>
        <Suspense fallback={<div className="page-content"><Skeleton style={{ height: 260 }} /></div>}>
          <Routes>
            <Route element={<Shell />}>
              <Route path="/requests/:requestId?" element={<RequestsPage />} />
              <Route path="/environment" element={<EnvironmentPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/mcp" element={<McpPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/requests" replace />} />
            </Route>
          </Routes>
          <WatcherAssistant />
        </Suspense>
      </WorkspaceProvider>
    </I18nProvider>
  );
}

export default function App() {
  const client = useMemo(() => queryClient, []);
  return (
    <QueryClientProvider client={client}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </QueryClientProvider>
  );
}
