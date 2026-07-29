import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultRealtimeConfig, type ApiRequest } from "../types";
import {
  disconnectRealtime,
  getRealtimeResponse,
  parseSseEvents,
  sendRealtimeMessage,
  startRealtimeRequest,
} from "./realtime";

const request = (transport: ApiRequest["transport"]): ApiRequest => ({
  id: `request_${transport}`,
  workspaceId: "workspace_1",
  name: `${transport} request`,
  transport,
  method: "GET",
  url: transport === "websocket" ? "wss://echo.example.test" : "https://events.example.test/stream",
  params: [],
  headers: [],
  body: { mode: "none", raw: "", formData: [] },
  realtime: { ...defaultRealtimeConfig(), message: '{"ping":true}', messageFormat: "json" },
  preRequestScript: "",
  postResponseScript: "",
  updatedAt: 1,
});

afterEach(() => {
  disconnectRealtime("request_sse");
  disconnectRealtime("request_websocket");
  vi.unstubAllGlobals();
});

describe("parseSseEvents", () => {
  it("keeps named events and multi-line payloads", () => {
    expect(parseSseEvents("id: evt-1\nevent: token\ndata: hello\ndata: world\n\n")).toEqual({
      events: [{ event: "token", eventId: "evt-1", data: "hello\nworld" }],
      remainder: "",
    });
  });
});

describe("realtime connections", () => {
  it("records every SSE event received from a stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("event: token\ndata: first\n\nevent: token\ndata: second\n\n"));
        controller.close();
      },
    });
    const mockedFetch = vi.fn().mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }));
    vi.stubGlobal("fetch", mockedFetch);

    const sseRequest = request("sse");
    sseRequest.method = "POST";
    sseRequest.body = { mode: "json", raw: '{"stream":true}', formData: [] };
    startRealtimeRequest(sseRequest, []);
    await vi.waitFor(() => {
      expect(getRealtimeResponse("request_sse")?.events.filter((event) => event.direction === "incoming")).toHaveLength(2);
    });

    expect(getRealtimeResponse("request_sse")?.events.map((event) => event.data)).toContain("first");
    expect(getRealtimeResponse("request_sse")?.events.map((event) => event.data)).toContain("second");
    expect(mockedFetch).toHaveBeenCalledWith(
      "https://events.example.test/stream",
      expect.objectContaining({ method: "POST", body: '{"stream":true}' }),
    );
  });

  it("sends and logs WebSocket messages", async () => {
    class FakeWebSocket {
      static instance: FakeWebSocket | undefined;
      onopen: (() => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      sent: string[] = [];

      constructor() {
        FakeWebSocket.instance = this;
      }

      send(message: string) {
        this.sent.push(message);
      }

      close() {
        this.onclose?.({ code: 1000, reason: "" } as CloseEvent);
      }
    }
    vi.stubGlobal("WebSocket", FakeWebSocket);

    const socketRequest = request("websocket");
    startRealtimeRequest(socketRequest, []);
    FakeWebSocket.instance?.onopen?.();
    sendRealtimeMessage(socketRequest, []);
    FakeWebSocket.instance?.onmessage?.({ data: "pong" } as MessageEvent);

    expect(FakeWebSocket.instance?.sent).toEqual(['{"ping":true}']);
    await vi.waitFor(() => {
      expect(getRealtimeResponse("request_websocket")?.events).toEqual(expect.arrayContaining([
        expect.objectContaining({ direction: "outgoing", data: '{"ping":true}' }),
        expect.objectContaining({ direction: "incoming", data: "pong" }),
      ]));
    });
  });
});
