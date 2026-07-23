import type { TreeNode } from "../types";

export interface VisibleTreeNode extends TreeNode {
  depth: number;
}

export function descendantsOf(nodes: TreeNode[], nodeId: string): Set<string> {
  const result = new Set<string>();
  const visit = (parentId: string) => {
    for (const node of nodes) {
      if (node.parentId === parentId && !result.has(node.id)) {
        result.add(node.id);
        visit(node.id);
      }
    }
  };
  visit(nodeId);
  return result;
}

export function canMoveNode(
  nodes: TreeNode[],
  nodeId: string,
  parentId: string | null,
) {
  if (nodeId === parentId) return false;
  const parent = parentId ? nodes.find((node) => node.id === parentId) : null;
  if (parentId && (!parent || parent.kind !== "folder")) return false;
  return !descendantsOf(nodes, nodeId).has(parentId ?? "");
}

export function visibleTree(
  nodes: TreeNode[],
  expandedIds: Set<string>,
  search: string,
): VisibleTreeNode[] {
  const sorted = [...nodes].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name),
  );
  const normalizedSearch = search.trim().toLowerCase();
  const included = new Set<string>();

  if (normalizedSearch) {
    for (const node of sorted) {
      if (node.name.toLowerCase().includes(normalizedSearch)) {
        included.add(node.id);
        let parentId = node.parentId;
        while (parentId) {
          included.add(parentId);
          parentId = sorted.find((item) => item.id === parentId)?.parentId ?? null;
        }
      }
    }
  }

  const result: VisibleTreeNode[] = [];
  const append = (parentId: string | null, depth: number) => {
    for (const node of sorted.filter((item) => item.parentId === parentId)) {
      if (normalizedSearch && !included.has(node.id)) continue;
      result.push({ ...node, depth });
      if (
        node.kind === "folder" &&
        (normalizedSearch || expandedIds.has(node.id))
      ) {
        append(node.id, depth + 1);
      }
    }
  };
  append(null, 0);
  return result;
}
