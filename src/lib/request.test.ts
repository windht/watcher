import { describe, expect, it } from "vitest";
import { substituteVariables } from "./request";

describe("request variables", () => {
  it("substitutes known values and clears missing values", () => {
    expect(
      substituteVariables("{{ base }}/users/{{id}}/{{missing}}", {
        base: "https://api.example.com",
        id: "42",
      }),
    ).toBe("https://api.example.com/users/42/");
  });
});
