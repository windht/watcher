import type { ApiRequest, KeyValueRow } from "../types";

export const SNIPPET_LANGUAGES = [
  {
    id: "curl",
    label: "Shell - cURL",
    syntax: "shell",
    searchTerms: "shell curl command line",
  },
  {
    id: "fetch",
    label: "JavaScript - Fetch",
    syntax: "javascript",
    searchTerms: "javascript fetch web api",
  },
  {
    id: "axios",
    label: "JavaScript - Axios",
    syntax: "javascript",
    searchTerms: "javascript axios http client",
  },
  {
    id: "jquery",
    label: "JavaScript - jQuery",
    syntax: "javascript",
    searchTerms: "javascript jquery ajax",
  },
] as const;

export type SnippetLanguageId = (typeof SNIPPET_LANGUAGES)[number]["id"];
export type SnippetSyntax = (typeof SNIPPET_LANGUAGES)[number]["syntax"];

type RequestEntry = [key: string, value: string];

function activeEntries(rows: KeyValueRow[]): RequestEntry[] {
  return rows
    .filter((row) => row.active && row.key)
    .map((row) => [row.key, row.value]);
}

function requestMethod(request: ApiRequest) {
  const method = request.method.trim().toUpperCase();
  return /^[A-Z][A-Z0-9-]*$/.test(method) ? method : "GET";
}

function requestTarget(request: ApiRequest) {
  const rawUrl = request.url.trim();
  const params = activeEntries(request.params);
  if (!params.length) return rawUrl;

  try {
    const url = new URL(rawUrl);
    for (const [key, value] of params) url.searchParams.append(key, value);
    return url.toString();
  } catch {
    const hashIndex = rawUrl.indexOf("#");
    const base = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex);
    const hash = hashIndex === -1 ? "" : rawUrl.slice(hashIndex);
    const separator = base.includes("?")
      ? base.endsWith("?") || base.endsWith("&")
        ? ""
        : "&"
      : "?";
    const query = params
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
    return `${base}${separator}${query}${hash}`;
  }
}

function requestHeaders(request: ApiRequest): RequestEntry[] {
  const headers = activeEntries(request.headers);
  if (
    request.body.mode === "json" &&
    !headers.some(([key]) => key.toLowerCase() === "content-type")
  ) {
    headers.push(["content-type", "application/json"]);
  }
  return headers;
}

function canSendBody(method: string) {
  return !["GET", "HEAD"].includes(method);
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function javascriptHeaders(headers: RequestEntry[]) {
  if (!headers.length) return [];
  return [
    "  headers: {",
    ...headers.map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)},`),
    "  },",
  ];
}

function jsonBodyExpression(request: ApiRequest) {
  if (request.body.mode === "json") {
    try {
      const value: unknown = JSON.parse(request.body.raw);
      return `JSON.stringify(${JSON.stringify(value, null, 2)})`;
    } catch {
      return JSON.stringify(request.body.raw);
    }
  }
  return JSON.stringify(request.body.raw);
}

function formDataDeclaration(request: ApiRequest) {
  return [
    "const formData = new FormData();",
    ...activeEntries(request.body.formData).map(
      ([key, value]) => `formData.append(${JSON.stringify(key)}, ${JSON.stringify(value)});`,
    ),
    "",
  ];
}

function curlSnippet(request: ApiRequest) {
  const method = requestMethod(request);
  const args = [
    `curl --request ${method}`,
    `--url ${shellQuote(requestTarget(request))}`,
    ...requestHeaders(request).map(
      ([key, value]) => `--header ${shellQuote(`${key}: ${value}`)}`,
    ),
  ];

  if (canSendBody(method)) {
    if (request.body.mode === "form-data") {
      args.push(
        ...activeEntries(request.body.formData).map(
          ([key, value]) => `--form-string ${shellQuote(`${key}=${value}`)}`,
        ),
      );
    } else if (request.body.mode !== "none") {
      args.push(`--data-raw ${shellQuote(request.body.raw)}`);
    }
  }

  const continuation = " " + "\\";
  return args
    .map((arg, index) => `${index === 0 ? arg : `  ${arg}`}${index < args.length - 1 ? continuation : ""}`)
    .join("\n");
}

function fetchSnippet(request: ApiRequest) {
  const method = requestMethod(request);
  const lines = request.body.mode === "form-data" && canSendBody(method)
    ? formDataDeclaration(request)
    : [];
  lines.push(
    `const response = await fetch(${JSON.stringify(requestTarget(request))}, {`,
    `  method: ${JSON.stringify(method)},`,
    ...javascriptHeaders(requestHeaders(request)),
  );

  if (canSendBody(method) && request.body.mode !== "none") {
    lines.push(`  body: ${request.body.mode === "form-data" ? "formData" : jsonBodyExpression(request)},`);
  }
  lines.push("});");
  return lines.join("\n");
}

function axiosSnippet(request: ApiRequest) {
  const method = requestMethod(request);
  const lines = ["import axios from \"axios\";", ""];
  if (request.body.mode === "form-data" && canSendBody(method)) lines.push(...formDataDeclaration(request));
  lines.push(
    "const response = await axios({",
    `  method: ${JSON.stringify(method.toLowerCase())},`,
    `  url: ${JSON.stringify(requestTarget(request))},`,
    ...javascriptHeaders(requestHeaders(request)),
  );
  if (canSendBody(method) && request.body.mode !== "none") {
    lines.push(`  data: ${request.body.mode === "form-data" ? "formData" : request.body.mode === "json" ? jsonBodyExpression(request).replace(/^JSON\.stringify\((.*)\)$/, "$1") : jsonBodyExpression(request)},`);
  }
  lines.push("});");
  return lines.join("\n");
}

function jquerySnippet(request: ApiRequest) {
  const method = requestMethod(request);
  const lines: string[] = [];
  if (request.body.mode === "form-data" && canSendBody(method)) lines.push(...formDataDeclaration(request));
  lines.push(
    "$.ajax({",
    `  url: ${JSON.stringify(requestTarget(request))},`,
    `  method: ${JSON.stringify(method)},`,
    ...javascriptHeaders(requestHeaders(request)),
  );
  if (canSendBody(method) && request.body.mode !== "none") {
    lines.push(`  data: ${request.body.mode === "form-data" ? "formData" : jsonBodyExpression(request)},`);
    if (request.body.mode === "form-data") {
      lines.push("  processData: false,", "  contentType: false,");
    }
  }
  lines.push("});");
  return lines.join("\n");
}

export function generateSnippet(request: ApiRequest, language: SnippetLanguageId) {
  switch (language) {
    case "curl":
      return curlSnippet(request);
    case "fetch":
      return fetchSnippet(request);
    case "axios":
      return axiosSnippet(request);
    case "jquery":
      return jquerySnippet(request);
  }
}
