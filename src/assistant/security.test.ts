import { describe, expect, it } from "vitest";
import type { ApiRequest } from "../types";
import {
  assertSafeToolHeaders,
  isSensitiveHeader,
  redactRequest,
  redactResponse,
} from "./security";

const request: ApiRequest = {
  id: "request_1",
  workspaceId: "workspace_1",
  name: "Private API",
  method: "GET",
  url: "https://example.com",
  params: [],
  headers: [
    { id: "1", active: true, key: "Authorization", value: "Bearer secret", description: "" },
    { id: "2", active: true, key: "X-Trace", value: "visible", description: "" },
  ],
  body: { mode: "none", raw: "", formData: [] },
  preRequestScript: "",
  postResponseScript: "",
  updatedAt: 1,
};

describe("assistant secret boundary", () => {
  it("recognizes common credential header names", () => {
    expect(isSensitiveHeader("API-Key")).toBe(true);
    expect(isSensitiveHeader("authorization")).toBe(true);
    expect(isSensitiveHeader("X-Trace")).toBe(false);
  });

  it("redacts credentials without mutating the saved request", () => {
    const redacted = redactRequest(request);
    expect(redacted.headers[0].value).toBe("••••••••");
    expect(redacted.headers[1].value).toBe("visible");
    expect(request.headers[0].value).toBe("Bearer secret");
  });

  it("rejects raw secrets from model tool arguments but permits placeholders", () => {
    expect(() => assertSafeToolHeaders([{ key: "Authorization", value: "secret" }])).toThrow(
      /private credential form/,
    );
    expect(() => assertSafeToolHeaders([{ key: "Authorization", value: "{{TOKEN}}" }])).not.toThrow();
  });

  it("redacts sensitive response headers and nested JSON fields", () => {
    const response = redactResponse({
      status: 200,
      statusText: "OK",
      headers: { "set-cookie": "session=secret", "x-trace": "visible" },
      body: JSON.stringify({ headers: { Authorization: "Bearer secret", Accept: "json" } }),
      durationMs: 2,
      sizeBytes: 10,
    });
    expect(response.headers["set-cookie"]).toBe("••••••••");
    expect(response.headers["x-trace"]).toBe("visible");
    expect(response.body).not.toContain("Bearer secret");
    expect(response.body).toContain("••••••••");
  });
});
