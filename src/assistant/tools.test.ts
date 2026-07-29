import { describe, expect, it } from "vitest";
import { createWatcherTools } from "./tools";

describe("Watcher assistant tools", () => {
  it("exposes realtime lifecycle tools alongside saved requests", () => {
    const tools = createWatcherTools();

    expect(Object.keys(tools)).toEqual(expect.arrayContaining([
      "create_request",
      "update_request",
      "send_request",
      "get_realtime_events",
      "send_realtime_message",
      "disconnect_realtime",
    ]));
  });
});
