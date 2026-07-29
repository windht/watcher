import { z } from "zod";
import { defaultRealtimeConfig, type ApiRequest, type TreeNode } from "../types";
import { createId } from "./utils";

export interface ImportResult {
  nodes: TreeNode[];
  requests: ApiRequest[];
  warnings: string[];
}

const recordSchema = z.record(z.string(), z.unknown());

function baseRequest(workspaceId: string, name: string): ApiRequest {
  return {
    id: createId("request"),
    workspaceId,
    name,
    transport: "http",
    method: "GET",
    url: "",
    params: [],
    headers: [],
    body: { mode: "none", raw: "", formData: [] },
    realtime: defaultRealtimeConfig(),
    preRequestScript: "",
    postResponseScript: "",
    updatedAt: Date.now(),
  };
}

function row(key: string, value = "", description = "") {
  return { id: createId("row"), active: true, key, value, description };
}

export function importOpenApi(
  input: unknown,
  workspaceId: string,
): ImportResult {
  const document = recordSchema.parse(input);
  const paths = recordSchema.parse(document.paths ?? {});
  const serverUrl =
    Array.isArray(document.servers) &&
    typeof (document.servers[0] as Record<string, unknown> | undefined)?.url === "string"
      ? String((document.servers[0] as Record<string, unknown>).url)
      : "";
  const nodes: TreeNode[] = [];
  const requests: ApiRequest[] = [];
  const folders = new Map<string, string>();

  for (const [path, pathValue] of Object.entries(paths)) {
    const operations = recordSchema.parse(pathValue);
    for (const [method, operationValue] of Object.entries(operations)) {
      if (!["get", "post", "put", "patch", "delete", "head", "options"].includes(method)) continue;
      const operation = recordSchema.parse(operationValue);
      const tag =
        Array.isArray(operation.tags) && operation.tags[0]
          ? String(operation.tags[0])
          : "Imported API";
      let folderId = folders.get(tag);
      if (!folderId) {
        folderId = createId("folder");
        folders.set(tag, folderId);
        nodes.push({
          id: folderId,
          workspaceId,
          parentId: null,
          kind: "folder",
          requestId: null,
          name: tag,
          position: folders.size - 1,
        });
      }

      const request = baseRequest(
        workspaceId,
        String(operation.summary ?? operation.operationId ?? path),
      );
      request.method = method.toUpperCase();
      request.url = `${serverUrl}${path}`;
      const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
      for (const parameterValue of parameters) {
        const parameter = recordSchema.parse(parameterValue);
        const target = parameter.in === "header" ? request.headers : request.params;
        if (parameter.in === "header" || parameter.in === "query") {
          target.push(
            row(
              String(parameter.name ?? ""),
              "",
              String(parameter.description ?? ""),
            ),
          );
        }
      }
      requests.push(request);
      nodes.push({
        id: createId("node"),
        workspaceId,
        parentId: folderId,
        kind: "request",
        requestId: request.id,
        name: request.name,
        position: nodes.filter((node) => node.parentId === folderId).length,
      });
    }
  }

  return { nodes, requests, warnings: [] };
}

export function importPostman(
  input: unknown,
  workspaceId: string,
): ImportResult {
  const document = recordSchema.parse(input);
  const nodes: TreeNode[] = [];
  const requests: ApiRequest[] = [];
  const warnings: string[] = [];

  const walk = (items: unknown[], parentId: string | null) => {
    items.forEach((itemValue, position) => {
      const item = recordSchema.parse(itemValue);
      if (Array.isArray(item.item)) {
        const folderId = createId("folder");
        nodes.push({
          id: folderId,
          workspaceId,
          parentId,
          kind: "folder",
          requestId: null,
          name: String(item.name ?? "Imported folder"),
          position,
        });
        walk(item.item, folderId);
        return;
      }
      if (!item.request) return;
      const source = recordSchema.parse(item.request);
      const request = baseRequest(workspaceId, String(item.name ?? "Imported request"));
      request.method = String(source.method ?? "GET").toUpperCase();
      const sourceUrl =
        typeof source.url === "string" ? source.url : recordSchema.parse(source.url ?? {}).raw;
      request.url = String(sourceUrl ?? "");
      if (Array.isArray(source.header)) {
        request.headers = source.header.map((headerValue) => {
          const header = recordSchema.parse(headerValue);
          return {
            ...row(String(header.key ?? ""), String(header.value ?? ""), String(header.description ?? "")),
            active: !header.disabled,
          };
        });
      }
      if (source.body) {
        const body = recordSchema.parse(source.body);
        if (body.mode === "raw") {
          request.body = { mode: "json", raw: String(body.raw ?? ""), formData: [] };
        } else if (body.mode === "formdata" && Array.isArray(body.formdata)) {
          request.body = {
            mode: "form-data",
            raw: "",
            formData: body.formdata.map((value) => {
              const entry = recordSchema.parse(value);
              return {
                ...row(String(entry.key ?? ""), String(entry.value ?? "")),
                active: !entry.disabled,
              };
            }),
          };
        }
      }
      requests.push(request);
      nodes.push({
        id: createId("node"),
        workspaceId,
        parentId,
        kind: "request",
        requestId: request.id,
        name: request.name,
        position,
      });
    });
  };

  if (!Array.isArray(document.item)) {
    throw new Error("The Postman collection has no item list.");
  }
  walk(document.item, null);
  return { nodes, requests, warnings };
}
