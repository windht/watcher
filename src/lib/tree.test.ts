import { describe, expect, it } from "vitest";
import type { TreeNode } from "../types";
import { canMoveNode, descendantsOf, visibleTree } from "./tree";

const nodes: TreeNode[] = [
  { id: "a", workspaceId: "w", parentId: null, kind: "folder", requestId: null, name: "Users", position: 0 },
  { id: "b", workspaceId: "w", parentId: "a", kind: "folder", requestId: null, name: "Admin", position: 0 },
  { id: "c", workspaceId: "w", parentId: "b", kind: "request", requestId: "r", name: "List users", position: 0 },
];

describe("tree invariants", () => {
  it("finds recursive descendants", () => {
    expect([...descendantsOf(nodes, "a")]).toEqual(["b", "c"]);
  });

  it("prevents cycles and requests as parents", () => {
    expect(canMoveNode(nodes, "a", "b")).toBe(false);
    expect(canMoveNode(nodes, "a", "c")).toBe(false);
    expect(canMoveNode(nodes, "c", "a")).toBe(true);
  });

  it("keeps ancestors when searching", () => {
    expect(visibleTree(nodes, new Set(), "list").map((node) => node.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
