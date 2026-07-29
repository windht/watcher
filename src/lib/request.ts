import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type {
  ApiRequest,
  EnvironmentVariable,
  HttpExecutionResult,
  KeyValueRow,
} from "../types";
import { isTauriRuntime } from "./utils";

export const REQUEST_TIMEOUT_MS = 30_000;

export function environmentMap(variables: EnvironmentVariable[]) {
  return Object.fromEntries(
    variables
      .filter((variable) => variable.active && variable.key)
      .map((variable) => [
        variable.key,
        variable.currentValue || variable.initialValue,
      ]),
  );
}

export function substituteVariables(value: string, environment: Record<string, string>) {
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => environment[key] ?? "");
}

export function activeRows(rows: KeyValueRow[], environment: Record<string, string>) {
  return rows.filter((row) => row.active && row.key).map((row) => ({
    key: substituteVariables(row.key, environment),
    value: substituteVariables(row.value, environment),
  }));
}

export function resolvedRequestUrl(request: ApiRequest, environment: Record<string, string>) {
  const url = new URL(substituteVariables(request.url, environment));
  for (const row of activeRows(request.params, environment)) {
    url.searchParams.append(row.key, row.value);
  }
  return url;
}

export function resolvedRequestBody(request: ApiRequest, environment: Record<string, string>) {
  if (request.body.mode === "json" || request.body.mode === "text") {
    return substituteVariables(request.body.raw, environment);
  }
  if (request.body.mode === "form-data") {
    const form = new FormData();
    for (const row of activeRows(request.body.formData, environment)) form.append(row.key, row.value);
    return form;
  }
  return undefined;
}

export async function executeRequest(
  request: ApiRequest,
  variables: EnvironmentVariable[],
): Promise<HttpExecutionResult> {
  if (request.transport !== "http") {
    return {
      status: 0,
      statusText: "Realtime request",
      headers: {},
      body: "",
      durationMs: 0,
      sizeBytes: 0,
      error: "Use the Realtime workspace to connect to SSE and WebSocket requests.",
    };
  }
  const environment = environmentMap(variables);
  const url = resolvedRequestUrl(request, environment);

  const headers = new Headers();
  for (const row of activeRows(request.headers, environment)) {
    headers.append(row.key, row.value);
  }

  const body = resolvedRequestBody(request, environment);
  if (request.body.mode === "json" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const startedAt = performance.now();
  try {
    const response = await (isTauriRuntime() ? tauriFetch : fetch)(url, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method.toUpperCase()) ? undefined : body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: text,
      durationMs: Math.round(performance.now() - startedAt),
      sizeBytes: new TextEncoder().encode(text).byteLength,
    };
  } catch (error) {
    return {
      status: 0,
      statusText: "Request failed",
      headers: {},
      body: "",
      durationMs: Math.round(performance.now() - startedAt),
      sizeBytes: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
