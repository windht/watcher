import { invoke } from "@tauri-apps/api/core";
import type {
  ApiRequest,
  AppSettings,
  EnvironmentVariable,
  HistoryEntry,
  HttpExecutionResult,
  MoveNodeInput,
  TabSession,
  TreeNode,
  Workspace,
  WorkspaceSnapshot,
} from "../types";
import { createId, isTauriRuntime } from "./utils";

const now = Date.now();
const demoWorkspace: Workspace = {
  id: "workspace_default",
  name: "My Workspace",
  createdAt: now,
};
const demoRequest: ApiRequest = {
  id: "request_welcome",
  workspaceId: demoWorkspace.id,
  name: "Echo request",
  method: "GET",
  url: "https://httpbin.org/anything",
  params: [
    { id: "row_demo", active: true, key: "source", value: "watcher", description: "Try editing this value" },
  ],
  headers: [],
  body: { mode: "none", raw: "", formData: [] },
  preRequestScript: "",
  postResponseScript: "",
  updatedAt: now,
};
const demoNode: TreeNode = {
  id: "node_welcome",
  workspaceId: demoWorkspace.id,
  parentId: null,
  kind: "request",
  requestId: demoRequest.id,
  name: demoRequest.name,
  position: 0,
};

const fallbackState: {
  workspaces: Workspace[];
  nodes: TreeNode[];
  requests: ApiRequest[];
  variables: EnvironmentVariable[];
  history: HistoryEntry[];
  tabs: TabSession[];
  selectedTabId: string | null;
  settings: AppSettings;
} = {
  workspaces: [demoWorkspace],
  nodes: [demoNode],
  requests: [demoRequest],
  variables: [],
  history: [],
  tabs: [],
  selectedTabId: null,
  settings: {
    selectedWorkspaceId: demoWorkspace.id,
    theme: "dark",
    language: "en-US",
    checkForUpdates: true,
    expandedNodeIds: [],
  },
};

function fallbackSnapshot(): WorkspaceSnapshot {
  const workspaceId = fallbackState.settings.selectedWorkspaceId;
  return structuredClone({
    workspaces: fallbackState.workspaces,
    selectedWorkspaceId: workspaceId,
    nodes: fallbackState.nodes.filter((node) => node.workspaceId === workspaceId),
    requests: fallbackState.requests.filter((request) => request.workspaceId === workspaceId),
    environmentVariables: fallbackState.variables.filter((variable) => variable.workspaceId === workspaceId),
    tabs: fallbackState.tabs.filter((tab) => tab.workspaceId === workspaceId),
    selectedTabId: fallbackState.selectedTabId,
    settings: fallbackState.settings,
  });
}

async function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) throw new Error("fallback");
  return invoke<T>(name, args);
}

export const api = {
  async getSnapshot(workspaceId?: string) {
    if (!isTauriRuntime()) {
      if (workspaceId) fallbackState.settings.selectedWorkspaceId = workspaceId;
      return fallbackSnapshot();
    }
    return command<WorkspaceSnapshot>("get_snapshot", { workspaceId });
  },

  async createWorkspace(name: string) {
    if (!isTauriRuntime()) {
      const workspace = { id: createId("workspace"), name, createdAt: Date.now() };
      fallbackState.workspaces.push(workspace);
      fallbackState.settings.selectedWorkspaceId = workspace.id;
      return structuredClone(workspace);
    }
    return command<Workspace>("create_workspace", { name });
  },

  async renameWorkspace(workspaceId: string, name: string) {
    if (!isTauriRuntime()) {
      const workspace = fallbackState.workspaces.find((item) => item.id === workspaceId);
      if (workspace) workspace.name = name;
      return;
    }
    return command<void>("rename_workspace", { workspaceId, name });
  },

  async createFolder(workspaceId: string, parentId: string | null, name: string) {
    if (!isTauriRuntime()) {
      const node: TreeNode = {
        id: createId("folder"), workspaceId, parentId, kind: "folder", requestId: null, name,
        position: fallbackState.nodes.filter((item) => item.workspaceId === workspaceId && item.parentId === parentId).length,
      };
      fallbackState.nodes.push(node);
      return structuredClone(node);
    }
    return command<TreeNode>("create_folder", { workspaceId, parentId, name });
  },

  async createRequest(workspaceId: string, parentId: string | null) {
    if (!isTauriRuntime()) {
      const request: ApiRequest = {
        ...structuredClone(demoRequest),
        id: createId("request"), workspaceId, name: "New request", url: "", params: [], updatedAt: Date.now(),
      };
      const node: TreeNode = {
        id: createId("node"), workspaceId, parentId, kind: "request", requestId: request.id, name: request.name,
        position: fallbackState.nodes.filter((item) => item.workspaceId === workspaceId && item.parentId === parentId).length,
      };
      fallbackState.requests.push(request);
      fallbackState.nodes.push(node);
      return { node: structuredClone(node), request: structuredClone(request) };
    }
    return command<{ node: TreeNode; request: ApiRequest }>("create_request", { workspaceId, parentId });
  },

  async renameNode(nodeId: string, name: string) {
    if (!isTauriRuntime()) {
      const node = fallbackState.nodes.find((item) => item.id === nodeId);
      if (node) {
        node.name = name;
        if (node.requestId) {
          const request = fallbackState.requests.find((item) => item.id === node.requestId);
          if (request) request.name = name;
        }
      }
      return;
    }
    return command<void>("rename_node", { nodeId, name });
  },

  async moveNode(input: MoveNodeInput) {
    if (!isTauriRuntime()) {
      const node = fallbackState.nodes.find((item) => item.id === input.nodeId);
      if (node) {
        node.parentId = input.parentId;
        node.position = input.position;
      }
      return;
    }
    return command<void>("move_node", { input });
  },

  async deleteNode(nodeId: string) {
    if (!isTauriRuntime()) {
      const remove = new Set([nodeId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of fallbackState.nodes) {
          if (node.parentId && remove.has(node.parentId) && !remove.has(node.id)) {
            remove.add(node.id);
            changed = true;
          }
        }
      }
      const requestIds = fallbackState.nodes.filter((node) => remove.has(node.id) && node.requestId).map((node) => node.requestId);
      fallbackState.nodes = fallbackState.nodes.filter((node) => !remove.has(node.id));
      fallbackState.requests = fallbackState.requests.filter((request) => !requestIds.includes(request.id));
      return;
    }
    return command<void>("delete_node", { nodeId });
  },

  async saveRequest(request: ApiRequest) {
    if (!isTauriRuntime()) {
      const index = fallbackState.requests.findIndex((item) => item.id === request.id);
      if (index >= 0) fallbackState.requests[index] = structuredClone(request);
      const node = fallbackState.nodes.find((item) => item.requestId === request.id);
      if (node) node.name = request.name;
      return;
    }
    return command<void>("save_request", { request });
  },

  async saveEnvironments(workspaceId: string, variables: EnvironmentVariable[]) {
    if (!isTauriRuntime()) {
      fallbackState.variables = fallbackState.variables.filter((item) => item.workspaceId !== workspaceId).concat(structuredClone(variables));
      return;
    }
    return command<void>("save_environments", { workspaceId, variables });
  },

  async saveTabs(workspaceId: string, tabs: TabSession[], selectedTabId: string | null) {
    if (!isTauriRuntime()) {
      fallbackState.tabs = fallbackState.tabs.filter((item) => item.workspaceId !== workspaceId).concat(structuredClone(tabs));
      fallbackState.selectedTabId = selectedTabId;
      return;
    }
    return command<void>("save_tabs", { workspaceId, tabs, selectedTabId });
  },

  async recordHistory(workspaceId: string, request: ApiRequest, response: HttpExecutionResult) {
    if (!isTauriRuntime()) {
      fallbackState.history.unshift({ id: createId("history"), workspaceId, request: structuredClone(request), response: structuredClone(response), createdAt: Date.now() });
      return;
    }
    return command<void>("record_history", { workspaceId, request, response });
  },

  async listHistory(workspaceId: string) {
    if (!isTauriRuntime()) return structuredClone(fallbackState.history.filter((entry) => entry.workspaceId === workspaceId));
    return command<HistoryEntry[]>("list_history", { workspaceId });
  },

  async clearHistory(workspaceId: string) {
    if (!isTauriRuntime()) {
      fallbackState.history = fallbackState.history.filter((entry) => entry.workspaceId !== workspaceId);
      return;
    }
    return command<void>("clear_history", { workspaceId });
  },

  async updateSettings(settings: AppSettings) {
    if (!isTauriRuntime()) {
      fallbackState.settings = structuredClone(settings);
      return;
    }
    return command<void>("update_settings", { settings });
  },

  async importItems(workspaceId: string, nodes: TreeNode[], requests: ApiRequest[]) {
    if (!isTauriRuntime()) {
      fallbackState.nodes.push(...structuredClone(nodes));
      fallbackState.requests.push(...structuredClone(requests));
      return;
    }
    return command<void>("import_items", { workspaceId, nodes, requests });
  },
};
