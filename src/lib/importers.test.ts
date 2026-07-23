import { describe, expect, it } from "vitest";
import { importOpenApi, importPostman } from "./importers";

describe("importers", () => {
  it("imports nested Postman folders", () => {
    const result = importPostman(
      {
        item: [{ name: "Users", item: [{ name: "List", request: { method: "GET", url: "https://example.com/users" } }] }],
      },
      "w",
    );
    expect(result.requests).toHaveLength(1);
    expect(result.nodes.find((node) => node.kind === "request")?.parentId).toBe(
      result.nodes.find((node) => node.kind === "folder")?.id,
    );
  });

  it("uses OpenAPI server and tags", () => {
    const result = importOpenApi(
      {
        servers: [{ url: "https://example.com" }],
        paths: { "/users": { get: { tags: ["Users"], summary: "List users" } } },
      },
      "w",
    );
    expect(result.requests[0].url).toBe("https://example.com/users");
  });
});
