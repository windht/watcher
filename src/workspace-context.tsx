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
import type { ApiRequest, TabSession, TreeNode, WorkspaceSnapshot } from "./types";

interface WorkspaceContextValue {
  snapshot: WorkspaceSnapshot;
  refresh: () => Promise<void>;
  openRequest: (request: ApiRequest, node?: TreeNode) => Promise<void>;
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
      const current = queryClient.getQueryData<WorkspaceSnapshot>(["snapshot"]) ?? snapshot;
      await api.saveTabs(current.selectedWorkspaceId, tabs, selectedTabId);
      queryClient.setQueryData<WorkspaceSnapshot>(["snapshot"], (value) =>
        value ? { ...value, tabs, selectedTabId } : value,
      );
    },
    [queryClient, snapshot],
  );

  const openRequest = useCallback(
    async (request: ApiRequest, node?: TreeNode) => {
      const current = queryClient.getQueryData<WorkspaceSnapshot>(["snapshot"]) ?? snapshot;
      if (request.transport !== "http") {
        queryClient.setQueryData<WorkspaceSnapshot>(["snapshot"], (value) => {
          if (!value) return value;
          return {
            ...value,
            nodes: node && !value.nodes.some((item) => item.id === node.id) ? [...value.nodes, node] : value.nodes,
            requests: value.requests.some((item) => item.id === request.id) ? value.requests : [...value.requests, request],
          };
        });
        navigate(`/realtime/${request.id}`);
        return;
      }
      let tab = current.tabs.find((item) => item.requestId === request.id);
      let tabs = current.tabs;
      if (!tab) {
        tab = {
          id: createId("tab"),
          workspaceId: current.selectedWorkspaceId,
          requestId: request.id,
          order: tabs.length,
          draft: structuredClone(request),
          dirty: false,
        };
        tabs = [...tabs, tab];
      }
      await api.saveTabs(current.selectedWorkspaceId, tabs, tab.id);
      queryClient.setQueryData<WorkspaceSnapshot>(["snapshot"], (value) => {
        if (!value) return value;
        return {
          ...value,
          nodes: node && !value.nodes.some((item) => item.id === node.id) ? [...value.nodes, node] : value.nodes,
          requests: value.requests.some((item) => item.id === request.id) ? value.requests : [...value.requests, request],
          tabs,
          selectedTabId: tab.id,
        };
      });
      navigate(`/requests/${request.id}`);
    },
    [navigate, queryClient, snapshot],
  );

  const closeTab = useCallback(
    async (tabId: string) => {
      const current = queryClient.getQueryData<WorkspaceSnapshot>(["snapshot"]) ?? snapshot;
      const index = current.tabs.findIndex((item) => item.id === tabId);
      const tabs = current.tabs.filter((item) => item.id !== tabId).map((item, order) => ({ ...item, order }));
      const nextTab = tabs[Math.max(0, index - 1)] ?? tabs[0] ?? null;
      await setTabs(tabs, nextTab?.id ?? null);
      navigate(nextTab ? `/requests/${nextTab.requestId}` : "/requests");
    },
    [navigate, queryClient, setTabs, snapshot],
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
