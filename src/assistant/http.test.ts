import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAssistantRequest } from "./http";

const mocks = vi.hoisted(() => ({
  nativeFetch: vi.fn(),
  isTauriRuntime: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: mocks.nativeFetch }));
vi.mock("../lib/utils", () => ({ isTauriRuntime: mocks.isTauriRuntime }));

describe("assistant HTTP transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses Tauri native HTTP in the deployed app", async () => {
    const response = new Response("ok");
    mocks.isTauriRuntime.mockReturnValue(true);
    mocks.nativeFetch.mockResolvedValue(response);
    const browserFetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchAssistantRequest("https://example.com/v1/chat/completions")).resolves.toBe(response);
    expect(mocks.nativeFetch).toHaveBeenCalledOnce();
    expect(browserFetch).not.toHaveBeenCalled();
  });
});
