export type ThemeMode = "dark" | "light" | "system";
export type Language = "en-US" | "zh-CN";
export type NodeKind = "folder" | "request";
export type BodyMode = "none" | "json" | "text" | "form-data";

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
}

export interface TreeNode {
  id: string;
  workspaceId: string;
  parentId: string | null;
  kind: NodeKind;
  requestId: string | null;
  name: string;
  position: number;
}

export interface KeyValueRow {
  id: string;
  active: boolean;
  key: string;
  value: string;
  description: string;
}

export interface RequestBody {
  mode: BodyMode;
  raw: string;
  formData: KeyValueRow[];
}

export interface ApiRequest {
  id: string;
  workspaceId: string;
  name: string;
  method: string;
  url: string;
  params: KeyValueRow[];
  headers: KeyValueRow[];
  body: RequestBody;
  preRequestScript: string;
  postResponseScript: string;
  updatedAt: number;
}

export type RequestDraft = ApiRequest;

export interface EnvironmentVariable {
  id: string;
  workspaceId: string;
  active: boolean;
  key: string;
  initialValue: string;
  currentValue: string;
  position: number;
}

export interface HttpExecutionResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  sizeBytes: number;
  error?: string;
}

export interface HistoryEntry {
  id: string;
  workspaceId: string;
  request: ApiRequest;
  response: HttpExecutionResult;
  createdAt: number;
}

export interface TabSession {
  id: string;
  workspaceId: string;
  requestId: string;
  order: number;
  draft: RequestDraft;
  dirty: boolean;
}

export interface AppSettings {
  selectedWorkspaceId: string;
  theme: ThemeMode;
  language: Language;
  checkForUpdates: boolean;
  expandedNodeIds: string[];
  mcpServerPort: number;
}

export interface McpServerStatus {
  running: boolean;
  port: number;
  endpoint: string;
  lastError?: string;
}

export interface WorkspaceSnapshot {
  workspaces: Workspace[];
  selectedWorkspaceId: string;
  nodes: TreeNode[];
  requests: ApiRequest[];
  environmentVariables: EnvironmentVariable[];
  tabs: TabSession[];
  selectedTabId: string | null;
  settings: AppSettings;
}

export interface ScriptContext {
  request: ApiRequest;
  response?: HttpExecutionResult;
  environment: Record<string, string>;
}

export interface ScriptResult extends ScriptContext {
  logs: string[];
}

export interface MoveNodeInput {
  nodeId: string;
  parentId: string | null;
  position: number;
}
