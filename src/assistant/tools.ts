import { tool, zodSchema } from "ai";
import { z } from "zod";
import { api } from "../lib/api";
import { executeRequest } from "../lib/request";
import type { ApiRequest, RequestBody } from "../types";
import {
  assertSafeToolHeaders,
  redactRequest,
  redactResponse,
  suggestedCredentialHeader,
  toolRows,
} from "./security";

const rowSchema = z.object({
  key: z.string(),
  value: z.string().optional(),
  active: z.boolean().optional(),
  description: z.string().optional(),
});

const bodySchema = z.object({
  mode: z.enum(["none", "json", "text", "form-data"]),
  raw: z.string().optional(),
  formData: z.array(rowSchema).optional(),
});

const requestFields = {
  name: z.string().min(1).optional(),
  method: z.string().min(1).optional(),
  url: z.string().optional(),
  params: z.array(rowSchema).optional(),
  headers: z.array(rowSchema).optional(),
  body: bodySchema.optional(),
};

function notifyChanged() {
  window.dispatchEvent(new Event("watcher:data-changed"));
}

async function snapshot() {
  return api.getSnapshot();
}

async function getRequest(requestId: string) {
  const state = await snapshot();
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) throw new Error("Request not found.");
  return { state, request };
}

function requestBody(value?: z.infer<typeof bodySchema>): RequestBody {
  return {
    mode: value?.mode ?? "none",
    raw: value?.raw ?? "",
    formData: toolRows(value?.formData ?? []),
  };
}

async function sendSavedRequest(requestId: string) {
  const { state, request } = await getRequest(requestId);
  const response = await executeRequest(request, state.environmentVariables);
  await api.recordHistory(request.workspaceId, request, response);
  notifyChanged();
  return {
    request: redactRequest(request),
    response: redactResponse(response),
    recordedInHistory: true,
    credentialRequest:
      response.status === 401 || response.status === 403
        ? {
            requestId,
            headerName: suggestedCredentialHeader(request),
            message: "This endpoint rejected the request. Add a credential privately below to retry.",
          }
        : null,
  };
}

export function createWatcherTools() {
  return {
    name_the_thread: tool({
      description: "Set a useful local title for the current assistant conversation.",
      inputSchema: zodSchema(z.object({ name: z.string().trim().min(1).max(80) })),
      execute: async ({ name }) => {
        window.dispatchEvent(new CustomEvent("watcher:assistant-thread-renamed", { detail: { name } }));
        return { name };
      },
    }),
    list_workspaces: tool({
      description: "List Watcher workspaces.",
      inputSchema: zodSchema(z.object({})),
      execute: async () => (await snapshot()).workspaces,
    }),
    get_workspace: tool({
      description: "Get a workspace and counts of its folders and requests.",
      inputSchema: zodSchema(z.object({ workspaceId: z.string() })),
      execute: async ({ workspaceId }) => {
        const state = await api.getSnapshot(workspaceId);
        const workspace = state.workspaces.find((item) => item.id === workspaceId);
        if (!workspace) throw new Error("Workspace not found.");
        return {
          ...workspace,
          folderCount: state.nodes.filter((item) => item.kind === "folder").length,
          requestCount: state.requests.length,
        };
      },
    }),
    create_workspace: tool({
      description: "Create a workspace.",
      inputSchema: zodSchema(z.object({ name: z.string().min(1) })),
      execute: async ({ name }) => {
        const workspace = await api.createWorkspace(name);
        notifyChanged();
        return workspace;
      },
    }),
    update_workspace: tool({
      description: "Rename a workspace.",
      inputSchema: zodSchema(z.object({ workspaceId: z.string(), name: z.string().min(1) })),
      execute: async ({ workspaceId, name }) => {
        await api.renameWorkspace(workspaceId, name);
        notifyChanged();
        return { workspaceId, name };
      },
    }),
    delete_workspace: tool({
      description: "Delete a workspace and everything in it. Only use when the user explicitly asks.",
      inputSchema: zodSchema(z.object({ workspaceId: z.string() })),
      execute: async ({ workspaceId }) => {
        const selectedWorkspaceId = await api.deleteWorkspace(workspaceId);
        notifyChanged();
        return { deleted: true, workspaceId, selectedWorkspaceId };
      },
    }),
    list_folders: tool({
      description: "List folders in a workspace.",
      inputSchema: zodSchema(z.object({ workspaceId: z.string() })),
      execute: async ({ workspaceId }) =>
        (await api.getSnapshot(workspaceId)).nodes.filter((item) => item.kind === "folder"),
    }),
    get_folder: tool({
      description: "Get a folder by node id.",
      inputSchema: zodSchema(z.object({ folderId: z.string() })),
      execute: async ({ folderId }) => {
        const folder = (await snapshot()).nodes.find((item) => item.id === folderId && item.kind === "folder");
        if (!folder) throw new Error("Folder not found.");
        return folder;
      },
    }),
    create_folder: tool({
      description: "Create a folder.",
      inputSchema: zodSchema(z.object({
        workspaceId: z.string(),
        parentId: z.string().nullable().optional(),
        name: z.string().min(1),
      })),
      execute: async ({ workspaceId, parentId, name }) => {
        const folder = await api.createFolder(workspaceId, parentId ?? null, name);
        notifyChanged();
        return folder;
      },
    }),
    update_folder: tool({
      description: "Rename and optionally move a folder.",
      inputSchema: zodSchema(z.object({
        folderId: z.string(),
        name: z.string().min(1).optional(),
        parentId: z.string().nullable().optional(),
      })),
      execute: async ({ folderId, name, parentId }) => {
        if (name) await api.renameNode(folderId, name);
        if (parentId !== undefined) await api.moveNode({ nodeId: folderId, parentId, position: 0 });
        notifyChanged();
        return { folderId, name, parentId };
      },
    }),
    delete_folder: tool({
      description: "Delete a folder and its nested requests. Only use when the user explicitly asks.",
      inputSchema: zodSchema(z.object({ folderId: z.string() })),
      execute: async ({ folderId }) => {
        await api.deleteNode(folderId);
        notifyChanged();
        return { deleted: true, folderId };
      },
    }),
    list_requests: tool({
      description: "List saved requests. Sensitive header values are always redacted.",
      inputSchema: zodSchema(z.object({ workspaceId: z.string().optional() })),
      execute: async ({ workspaceId }) => {
        const state = workspaceId ? await api.getSnapshot(workspaceId) : await snapshot();
        return state.requests.map(redactRequest);
      },
    }),
    get_request: tool({
      description: "Get one saved request. Sensitive header values are always redacted.",
      inputSchema: zodSchema(z.object({ requestId: z.string() })),
      execute: async ({ requestId }) => redactRequest((await getRequest(requestId)).request),
    }),
    create_request: tool({
      description:
        "Create a saved request. For credential headers, provide the header name with no value; the user will enter it in a private tool UI.",
      inputSchema: zodSchema(z.object({
        workspaceId: z.string().optional(),
        parentId: z.string().nullable().optional(),
        name: z.string().min(1),
        method: z.string().min(1),
        url: z.string(),
        params: z.array(rowSchema).optional(),
        headers: z.array(rowSchema).optional(),
        body: bodySchema.optional(),
      })),
      execute: async (input) => {
        assertSafeToolHeaders(input.headers ?? []);
        const state = await snapshot();
        const created = await api.createRequest(input.workspaceId ?? state.selectedWorkspaceId, input.parentId ?? null);
        const request: ApiRequest = {
          ...created.request,
          name: input.name,
          method: input.method.toUpperCase(),
          url: input.url,
          params: toolRows(input.params ?? []),
          headers: toolRows(input.headers ?? []),
          body: requestBody(input.body),
          updatedAt: Date.now(),
        };
        await api.saveRequest(request);
        notifyChanged();
        return redactRequest(request);
      },
    }),
    update_request: tool({
      description:
        "Update a saved request. Omitted fields remain unchanged. Credential values must never be passed here.",
      inputSchema: zodSchema(z.object({ requestId: z.string(), ...requestFields })),
      execute: async ({ requestId, ...updates }) => {
        if (updates.headers) assertSafeToolHeaders(updates.headers);
        const current = (await getRequest(requestId)).request;
        const request: ApiRequest = {
          ...current,
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.method !== undefined ? { method: updates.method.toUpperCase() } : {}),
          ...(updates.url !== undefined ? { url: updates.url } : {}),
          ...(updates.params !== undefined ? { params: toolRows(updates.params) } : {}),
          ...(updates.headers !== undefined ? { headers: toolRows(updates.headers) } : {}),
          ...(updates.body !== undefined ? { body: requestBody(updates.body) } : {}),
          updatedAt: Date.now(),
        };
        await api.saveRequest(request);
        notifyChanged();
        return redactRequest(request);
      },
    }),
    delete_request: tool({
      description: "Delete a saved request. Only use when the user explicitly asks.",
      inputSchema: zodSchema(z.object({ requestId: z.string() })),
      execute: async ({ requestId }) => {
        const state = await snapshot();
        const node = state.nodes.find((item) => item.requestId === requestId);
        if (!node) throw new Error("Request not found.");
        await api.deleteNode(node.id);
        notifyChanged();
        return { deleted: true, requestId };
      },
    }),
    send_request: tool({
      description: "Execute one saved request and record the result in Watcher History.",
      inputSchema: zodSchema(z.object({ requestId: z.string() })),
      execute: async ({ requestId }) => sendSavedRequest(requestId),
    }),
    send_requests: tool({
      description: "Execute saved requests in order and record every result in Watcher History.",
      inputSchema: zodSchema(z.object({ requestIds: z.array(z.string()).min(1) })),
      execute: async ({ requestIds }) => {
        const results = [];
        for (const requestId of requestIds) results.push(await sendSavedRequest(requestId));
        return results;
      },
    }),
  };
}
