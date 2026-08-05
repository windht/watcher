import { describe, expect, it } from "vitest";
import type { ApiRequest } from "../types";
import { generateSnippet } from "./snippets";

function request(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    id: "request_1",
    workspaceId: "workspace_1",
    name: "Create user",
    transport: "http",
    method: "POST",
    url: "https://api.example.com/users",
    params: [
      { id: "param_1", active: true, key: "source", value: "watcher", description: "" },
    ],
    headers: [
      { id: "header_1", active: true, key: "Authorization", value: "Bearer token", description: "" },
    ],
    body: {
      mode: "json",
      raw: '{"name":"Ada","active":true}',
      formData: [],
    },
    realtime: { protocols: [], message: "", messageFormat: "text" },
    preRequestScript: "",
    postResponseScript: "",
    updatedAt: 0,
    ...overrides,
  };
}

describe("request code snippets", () => {
  it("generates a cURL command with params, headers, and a JSON body", () => {
    const snippet = generateSnippet(request(), "curl");

    expect(snippet).toContain("curl --request POST");
    expect(snippet).toContain("--url 'https://api.example.com/users?source=watcher'");
    expect(snippet).toContain("--header 'Authorization: Bearer token'");
    expect(snippet).toContain("--header 'content-type: application/json'");
    expect(snippet).toContain("--data-raw '{\"name\":\"Ada\",\"active\":true}'");
  });

  it("generates Fetch code with an object-shaped JSON body", () => {
    const snippet = generateSnippet(request(), "fetch");

    expect(snippet).toContain('const response = await fetch("https://api.example.com/users?source=watcher"');
    expect(snippet).toContain('"Authorization": "Bearer token"');
    expect(snippet).toContain('body: JSON.stringify({\n  "name": "Ada",\n  "active": true\n})');
  });

  it("generates Axios and jQuery form-data snippets", () => {
    const formRequest = request({
      body: {
        mode: "form-data",
        raw: "",
        formData: [
          { id: "field_1", active: true, key: "name", value: "Ada", description: "" },
        ],
      },
    });

    const axios = generateSnippet(formRequest, "axios");
    expect(axios).toContain('import axios from "axios";');
    expect(axios).toContain('formData.append("name", "Ada");');
    expect(axios).toContain("data: formData");

    const jquery = generateSnippet(formRequest, "jquery");
    expect(jquery).toContain("$.ajax({");
    expect(jquery).toContain("processData: false");
    expect(jquery).toContain("contentType: false");
  });

  it("does not attach a body to GET or HEAD requests", () => {
    const snippet = generateSnippet(request({ method: "GET" }), "fetch");

    expect(snippet).not.toContain("body:");
  });
});
