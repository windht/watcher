import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type {
  ApiRequest,
  EnvironmentVariable,
  RealtimeEvent,
  RealtimeResponse,
} from "../types";
import {
  activeRows,
  environmentMap,
  resolvedRequestBody,
  resolvedRequestUrl,
  substituteVariables,
} from "./request";
import { isTauriRuntime } from "./utils";

type RealtimeListener = (response: RealtimeResponse) => void;

type ActiveConnection = {
  session: number;
  transport: RealtimeResponse["transport"];
  close: () => void;
  send?: (message: string) => void;
};

export type ParsedSseEvent = Pick<RealtimeEvent, "event" | "data" | "eventId">;

const connections = new Map<string, ActiveConnection>();
const responses = new Map<string, RealtimeResponse>();
const listeners = new Map<string, Set<RealtimeListener>>();
let sessionSequence = 0;

function cloneResponse(response: RealtimeResponse): RealtimeResponse {
  return {
    ...response,
    headers: { ...response.headers },
    events: response.events.map((event) => ({ ...event })),
  };
}

function emit(requestId: string, response: RealtimeResponse) {
  const snapshot = cloneResponse(response);
  responses.set(requestId, snapshot);
  for (const listener of listeners.get(requestId) ?? []) listener(cloneResponse(snapshot));
}

function update(
  requestId: string,
  updater: (current: RealtimeResponse) => RealtimeResponse,
) {
  const current = responses.get(requestId);
  if (!current) return;
  emit(requestId, updater(cloneResponse(current)));
}

function isCurrent(requestId: string, session: number) {
  return connections.get(requestId)?.session === session;
}

function systemEvent(message: string): Omit<RealtimeEvent, "sequence"> {
  return {
    timestamp: Date.now(),
    direction: "system",
    event: "connection",
    data: message,
  };
}

function appendEvent(requestId: string, event: Omit<RealtimeEvent, "sequence">) {
  update(requestId, (current) => {
    const next: RealtimeEvent = { ...event, sequence: current.events.length + 1 };
    return {
      ...current,
      events: [...current.events, next],
      sizeBytes: current.sizeBytes + new TextEncoder().encode(next.data).byteLength,
    };
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function finish(
  requestId: string,
  session: number,
  state: "disconnected" | "error",
  message: string,
  error?: string,
) {
  if (!isCurrent(requestId, session)) return;
  connections.delete(requestId);
  appendEvent(requestId, systemEvent(message));
  update(requestId, (current) => ({
    ...current,
    state,
    endedAt: Date.now(),
    error,
  }));
}

function connectionHeaders(response: Response) {
  return Object.fromEntries(response.headers.entries());
}

function realtimeUrl(request: ApiRequest, environment: Record<string, string>) {
  const url = resolvedRequestUrl(request, environment);
  if (request.transport === "websocket") {
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    if (url.protocol !== "ws:" && url.protocol !== "wss:") {
      throw new Error("WebSocket URLs must use ws:// or wss://.");
    }
  } else if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SSE URLs must use http:// or https://.");
  }
  return url.toString();
}

function initialResponse(request: ApiRequest, url: string): RealtimeResponse {
  return {
    transport: request.transport === "sse" ? "sse" : "websocket",
    state: "connecting",
    url,
    headers: {},
    startedAt: Date.now(),
    events: [],
    sizeBytes: 0,
  };
}

function sseHeaders(request: ApiRequest, environment: Record<string, string>) {
  const headers = new Headers();
  headers.set("accept", "text/event-stream");
  for (const row of activeRows(request.headers, environment)) headers.append(row.key, row.value);
  if (request.body.mode === "json" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return headers;
}

function splitSseBlocks(input: string) {
  const events: ParsedSseEvent[] = [];
  const boundary = /\r?\n\r?\n/g;
  let start = 0;
  let match = boundary.exec(input);
  while (match) {
    const lines = input.slice(start, match.index).split(/\r?\n/);
    start = match.index + match[0].length;
    let event = "message";
    let eventId: string | undefined;
    const data: string[] = [];
    for (const line of lines) {
      if (!line || line.startsWith(":")) continue;
      const separator = line.indexOf(":");
      const key = separator >= 0 ? line.slice(0, separator) : line;
      const value = separator >= 0 ? line.slice(separator + 1).replace(/^ /, "") : "";
      if (key === "event") event = value || "message";
      if (key === "id") eventId = value;
      if (key === "data") data.push(value);
    }
    if (data.length > 0) events.push({ event, eventId, data: data.join("\n") });
    match = boundary.exec(input);
  }
  return { events, remainder: input.slice(start) };
}

export function parseSseEvents(input: string) {
  return splitSseBlocks(input);
}

async function startSse(
  request: ApiRequest,
  variables: EnvironmentVariable[],
  session: number,
  controller: AbortController,
) {
  const environment = environmentMap(variables);
  try {
    const response = await (isTauriRuntime() ? tauriFetch : fetch)(
      realtimeUrl(request, environment),
      {
        method: request.method,
        headers: sseHeaders(request, environment),
        body: ["GET", "HEAD"].includes(request.method.toUpperCase())
          ? undefined
          : resolvedRequestBody(request, environment),
        signal: controller.signal,
      },
    );
    if (!isCurrent(request.id, session)) return;
    update(request.id, (current) => ({
      ...current,
      status: response.status,
      statusText: response.statusText,
      headers: connectionHeaders(response),
      state: response.ok ? "connected" : "error",
      connectedAt: response.ok ? Date.now() : undefined,
    }));
    if (!response.ok) {
      const body = await response.text();
      finish(
        request.id,
        session,
        "error",
        `SSE request failed with ${response.status} ${response.statusText}.`,
        body || `${response.status} ${response.statusText}`,
      );
      return;
    }
    appendEvent(request.id, systemEvent("Connected. Listening for server events."));
    const reader = response.body?.getReader();
    if (!reader) {
      finish(request.id, session, "error", "The response did not expose a readable SSE stream.", "No response stream.");
      return;
    }
    const decoder = new TextDecoder();
    let pending = "";
    while (isCurrent(request.id, session)) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const parsed = splitSseBlocks(pending);
      pending = parsed.remainder;
      for (const event of parsed.events) {
        if (!isCurrent(request.id, session)) return;
        appendEvent(request.id, {
          timestamp: Date.now(),
          direction: "incoming",
          event: event.event,
          data: event.data,
          eventId: event.eventId,
        });
      }
    }
    if (isCurrent(request.id, session)) {
      pending += decoder.decode();
      const trailing = splitSseBlocks(`${pending}\n\n`);
      for (const event of trailing.events) {
        appendEvent(request.id, {
          timestamp: Date.now(),
          direction: "incoming",
          event: event.event,
          data: event.data,
          eventId: event.eventId,
        });
      }
      finish(request.id, session, "disconnected", "The server closed the SSE stream.");
    }
  } catch (error) {
    if (controller.signal.aborted || !isCurrent(request.id, session)) return;
    const message = errorMessage(error);
    finish(request.id, session, "error", `SSE connection failed: ${message}`, message);
  }
}

async function webSocketMessage(data: unknown) {
  if (typeof data === "string") return data;
  if (data instanceof Blob) return data.text();
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  return String(data);
}

function startWebSocket(request: ApiRequest, variables: EnvironmentVariable[], session: number) {
  const environment = environmentMap(variables);
  let url: string;
  try {
    url = realtimeUrl(request, environment);
  } catch (error) {
    const response = initialResponse(request, request.url);
    response.state = "error";
    response.error = errorMessage(error);
    response.endedAt = Date.now();
    emit(request.id, response);
    appendEvent(request.id, systemEvent(response.error));
    return response;
  }
  let socket: WebSocket;
  try {
    socket = new WebSocket(url, request.realtime.protocols.filter(Boolean));
  } catch (error) {
    const response = initialResponse(request, url);
    response.state = "error";
    response.error = errorMessage(error);
    response.endedAt = Date.now();
    emit(request.id, response);
    appendEvent(request.id, systemEvent(response.error));
    return response;
  }

  connections.set(request.id, {
    session,
    transport: "websocket",
    close: () => socket.close(),
    send: (message) => socket.send(message),
  });
  socket.onopen = () => {
    if (!isCurrent(request.id, session)) return;
    update(request.id, (current) => ({ ...current, state: "connected", connectedAt: Date.now() }));
    appendEvent(request.id, systemEvent("Connected. Ready to send and receive messages."));
    if (request.headers.some((header) => header.active && header.key)) {
      appendEvent(request.id, systemEvent("WebSocket handshakes cannot send custom headers in the desktop webview; use query parameters or subprotocols."));
    }
  };
  socket.onmessage = (event) => {
    void webSocketMessage(event.data).then((data) => {
      if (!isCurrent(request.id, session)) return;
      appendEvent(request.id, { timestamp: Date.now(), direction: "incoming", event: "message", data });
    });
  };
  socket.onerror = () => {
    if (!isCurrent(request.id, session)) return;
    update(request.id, (current) => ({ ...current, error: "The WebSocket connection encountered an error." }));
  };
  socket.onclose = (event) => {
    if (!isCurrent(request.id, session)) return;
    const details = event.reason ? `: ${event.reason}` : "";
    const error = event.code === 1000 ? undefined : `Closed with code ${event.code}${details}`;
    finish(
      request.id,
      session,
      error ? "error" : "disconnected",
      error ? `WebSocket ${error}.` : "Disconnected from WebSocket.",
      error,
    );
  };
  return responses.get(request.id)!;
}

export function startRealtimeRequest(request: ApiRequest, variables: EnvironmentVariable[]) {
  if (request.transport === "http") {
    throw new Error("HTTP requests cannot be started as realtime connections.");
  }
  disconnectRealtime(request.id, false);
  const session = ++sessionSequence;
  const environment = environmentMap(variables);
  let url: string;
  try {
    url = realtimeUrl(request, environment);
  } catch (error) {
    const response = initialResponse(request, request.url);
    response.state = "error";
    response.error = errorMessage(error);
    response.endedAt = Date.now();
    emit(request.id, response);
    appendEvent(request.id, systemEvent(response.error));
    return response;
  }
  const response = initialResponse(request, url);
  emit(request.id, response);
  appendEvent(request.id, systemEvent(`Connecting to ${url}.`));

  if (request.transport === "websocket") return startWebSocket(request, variables, session);

  const controller = new AbortController();
  connections.set(request.id, {
    session,
    transport: "sse",
    close: () => controller.abort(),
  });
  void startSse(request, variables, session, controller);
  return response;
}

export function getRealtimeResponse(requestId: string) {
  const response = responses.get(requestId);
  return response ? cloneResponse(response) : undefined;
}

export function subscribeRealtimeResponse(requestId: string, listener: RealtimeListener) {
  const requestListeners = listeners.get(requestId) ?? new Set<RealtimeListener>();
  requestListeners.add(listener);
  listeners.set(requestId, requestListeners);
  const current = getRealtimeResponse(requestId);
  if (current) listener(current);
  return () => {
    requestListeners.delete(listener);
    if (requestListeners.size === 0) listeners.delete(requestId);
  };
}

export function sendRealtimeMessage(
  request: ApiRequest,
  variables: EnvironmentVariable[],
  message = request.realtime.message,
) {
  const connection = connections.get(request.id);
  if (!connection || connection.transport !== "websocket" || !connection.send) {
    throw new Error("Connect this WebSocket before sending a message.");
  }
  const response = responses.get(request.id);
  if (!response || response.state !== "connected") {
    throw new Error("The WebSocket is not connected.");
  }
  const payload = substituteVariables(message, environmentMap(variables));
  if (request.realtime.messageFormat === "json") JSON.parse(payload);
  connection.send(payload);
  appendEvent(request.id, { timestamp: Date.now(), direction: "outgoing", event: "message", data: payload });
  return getRealtimeResponse(request.id)!;
}

export function disconnectRealtime(requestId: string, includeEvent = true) {
  const connection = connections.get(requestId);
  if (!connection) return getRealtimeResponse(requestId);
  connections.delete(requestId);
  connection.close();
  if (includeEvent) {
    appendEvent(requestId, systemEvent("Disconnected by user."));
    update(requestId, (current) => ({ ...current, state: "disconnected", endedAt: Date.now() }));
  }
  return getRealtimeResponse(requestId);
}

export function clearRealtimeEvents(requestId: string) {
  update(requestId, (current) => ({ ...current, events: [], sizeBytes: 0 }));
  return getRealtimeResponse(requestId);
}
