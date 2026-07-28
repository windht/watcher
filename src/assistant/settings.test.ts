import { beforeEach, describe, expect, it } from "vitest";
import { persistAssistantSettings } from "./settings";

describe("assistant provider settings", () => {
  beforeEach(() => window.localStorage.clear());

  it("accepts either an API base URL or a copied chat-completions endpoint", () => {
    expect(persistAssistantSettings({
      baseUrl: "https://opencode.ai/zen/go/v1/chat/completions",
      apiKey: "secret",
      model: "mimo-v2.5",
    }).baseUrl).toBe("https://opencode.ai/zen/go/v1");
  });
});
