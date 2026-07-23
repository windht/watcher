import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./lib/api";
import { createId } from "./lib/utils";
import type { ApiRequest, TabSession, WorkspaceSnapshot } from "./types";

interface WorkspaceContextValue {
  snapshot: WorkspaceSnapshot;
  refresh: () => Promise<void>;
  openRequest: (request: ApiRequest) => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  setTabs: (tabs: TabSession[], selectedTabId: string | null) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  snapshot,
  children,
}: {
  snapshot: WorkspaceSnapshot;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
  }, [queryClient]);

  const setTabs = useCallback(
    async (tabs: TabSession[], selectedTabId: string | null) => {
      await api.saveTabs(snapshot.selectedWorkspaceId, tabs, selectedTabId);
      queryClient.setQueryData<WorkspaceSnapshot>(["snapshot"], (current) =>
        current
          ? { ...current, tabs, selectedTabId }
          : current,
      );
    },
    [queryClient, snapshot.selectedWorkspaceId],
  );

  const openRequest = useCallback(
    async (request: ApiRequest) => {
      let tab = snapshot.tabs.find((item) => item.requestId === request.id);
      let tabs = snapshot.tabs;
      if (!tab) {
        tab = {
          id: createId("tab"),
          workspaceId: snapshot.selectedWorkspaceId,
          requestId: request.id,
          order: tabs.length,
          draft: structuredClone(request),
          dirty: false,
        };
        tabs = [...tabs, tab];
      }
      await setTabs(tabs, tab.id);
      navigate(`/requests/${request.id}`);
    },
    [navigate, setTabs, snapshot.selectedWorkspaceId, snapshot.tabs],
  );

  const closeTab = useCallback(
    async (tabId: string) => {
      const index = snapshot.tabs.findIndex((item) => item.id === tabId);
      const tabs = snapshot.tabs.filter((item) => item.id !== tabId).map((item, order) => ({ ...item, order }));
      const nextTab = tabs[Math.max(0, index - 1)] ?? tabs[0] ?? null;
      await setTabs(tabs, nextTab?.id ?? null);
      navigate(nextTab ? `/requests/${nextTab.requestId}` : "/requests");
    },
    [navigate, setTabs, snapshot.tabs],
  );

  const value = useMemo(
    () => ({ snapshot, refresh, openRequest, closeTab, setTabs }),
    [snapshot, refresh, openRequest, closeTab, setTabs],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}

export function useSnapshotQuery() {
  return useQuery({
    queryKey: ["snapshot"],
    queryFn: () => api.getSnapshot(),
    staleTime: Infinity,
  });
}
