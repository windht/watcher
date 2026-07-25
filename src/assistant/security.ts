import type { ApiRequest, HttpExecutionResult, KeyValueRow } from "../types";

export function isSensitiveHeader(name: string) {
  const normalized = name.toLowerCase().replace(/[-_]/g, "");
  return normalized.includes("authorization") ||
    normalized.includes("apikey") ||
    normalized.includes("accesstoken") ||
    normalized.includes("secret") ||
    normalized === "token" ||
    normalized.includes("cookie");
}

export function redactRequest(request: ApiRequest): ApiRequest {
  return {
    ...structuredClone(request),
    headers: request.headers.map((header) => ({
      ...header,
      value: isSensitiveHeader(header.key) && header.value ? "••••••••" : header.value,
    })),
  };
}

export function redactResponse(response: HttpExecutionResult): HttpExecutionResult {
  return {
    ...structuredClone(response),
    headers: Object.fromEntries(
      Object.entries(response.headers).map(([key, value]) => [
        key,
        isSensitiveHeader(key) ? "••••••••" : value,
      ]),
    ),
    body: redactJsonText(response.body),
  };
}

function redactJsonText(body: string) {
  try {
    return JSON.stringify(redactJsonValue(JSON.parse(body)), null, 2);
  } catch {
    return body;
  }
}

function redactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveHeader(key) ? "••••••••" : redactJsonValue(item),
    ]),
  );
}

export function assertSafeToolHeaders(headers: Array<{ key: string; value?: string }>) {
  for (const header of headers) {
    if (isSensitiveHeader(header.key) && header.value && !header.value.trim().startsWith("{{")) {
      throw new Error(
        `Sensitive header "${header.key}" must be provided through Watcher's private credential form, not the AI conversation.`,
      );
    }
  }
}

export function toolRows(
  rows: Array<{ key: string; value?: string; active?: boolean; description?: string }>,
): KeyValueRow[] {
  return rows.map((row) => ({
    id: crypto.randomUUID(),
    active: row.active ?? true,
    key: row.key,
    value: row.value ?? "",
    description: row.description ?? "",
  }));
}

export function suggestedCredentialHeader(request: ApiRequest) {
  const unresolved = request.headers.find(
    (header) => isSensitiveHeader(header.key) && (!header.value || header.value.includes("{{")),
  );
  return unresolved?.key ?? "Authorization";
}
