import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileBraces,
  Folder,
  FolderOpen,
  FolderPlus,
  Import,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { api } from "../lib/api";
import { importOpenApi, importPostman } from "../lib/importers";
import { canMoveNode, visibleTree, type VisibleTreeNode } from "../lib/tree";
import { cn, createId } from "../lib/utils";
import { useUiStore } from "../store/ui";
import type { ApiRequest, KeyValueRow, TreeNode, WorkspaceSnapshot } from "../types";
import { useWorkspace } from "../workspace-context";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { useI18n } from "../i18n";

const methodClass = (method?: string) =>
  `method-${(method ?? "get").toLowerCase()}`;

function requestMarker(request?: ApiRequest) {
  if (request?.transport === "sse") return { label: "SSE", className: "transport-sse" };
  if (request?.transport === "websocket") return { label: "WS", className: "transport-websocket" };
  return { label: request?.method.slice(0, 6), className: methodClass(request?.method) };
}

function remappedRows(rows: KeyValueRow[]) {
  return rows.map((row) => ({ ...row, id: createId("row") }));
}

function cloneSubtree(
  snapshot: WorkspaceSnapshot,
  root: VisibleTreeNode,
): { rootId: string; nodes: TreeNode[]; requests: ApiRequest[] } {
  const collectIds = (nodeId: string): string[] => {
    const children = snapshot.nodes
      .filter((node) => node.parentId === nodeId)
      .sort((a, b) => a.position - b.position);
    return [nodeId, ...children.flatMap((child) => collectIds(child.id))];
  };

  const ids = collectIds(root.id);
  const idMap = new Map(ids.map((id) => [id, createId(id.startsWith("folder") ? "folder" : "node")]));
  const siblingCount = snapshot.nodes.filter((node) => node.parentId === root.parentId).length;
  const nodes: TreeNode[] = [];
  const requests: ApiRequest[] = [];
  const rootId = idMap.get(root.id)!;

  for (const id of ids) {
    const node = snapshot.nodes.find((item) => item.id === id);
    if (!node) continue;
    const isRoot = id === root.id;
    let requestId: string | null = null;

    if (node.requestId) {
      const source = snapshot.requests.find((item) => item.id === node.requestId);
      if (source) {
        requestId = createId("request");
        requests.push({
          ...structuredClone(source),
          id: requestId,
          name: isRoot ? `${source.name} (copy)` : source.name,
          params: remappedRows(source.params),
          headers: remappedRows(source.headers),
          body: {
            ...source.body,
            formData: remappedRows(source.body.formData),
          },
          updatedAt: Date.now(),
        });
      }
    }

    nodes.push({
      ...node,
      id: idMap.get(id)!,
      parentId: isRoot ? root.parentId : idMap.get(node.parentId ?? "") ?? null,
      requestId,
      name: isRoot ? `${node.name} (copy)` : node.name,
      position: isRoot ? siblingCount : node.position,
    });
  }

  return { rootId, nodes, requests };
}

function SortableTreeRow({
  node,
  request,
  expanded,
  selected,
  onToggle,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  node: VisibleTreeNode;
  request?: ApiRequest;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const sortable = useSortable({ id: node.id });
  const marker = requestMarker(request);
  return (
    <div
      ref={sortable.setNodeRef}
      {...sortable.attributes}
      {...sortable.listeners}
      className={cn("tree-row", selected && "selected", sortable.isDragging && "dragging")}
      style={{
        paddingLeft: 7 + node.depth * 16,
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      onDoubleClick={onOpen}
      onClick={node.kind === "request" ? onOpen : onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
        if (event.key === "Delete") onDelete();
      }}
      role="treeitem"
      tabIndex={0}
      aria-expanded={node.kind === "folder" ? expanded : undefined}
    >
      {node.kind === "folder" ? (
        <>
          <button
            className="tree-toggle"
            aria-label={expanded ? "Collapse folder" : "Expand folder"}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
        </>
      ) : (
        <>
          <span className="tree-toggle" />
          <span className={cn("tree-method", marker.className)}>
            {marker.label}
          </span>
        </>
      )}
      <span className="tree-name">{node.name}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="tree-toggle tree-more"
            aria-label={t("moreActions")}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <MoreHorizontal size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem onSelect={() => onDuplicate()}>
            <Copy size={13} />
            {t("duplicate")}
          </DropdownMenuItem>
          <DropdownMenuItem tone="danger" onSelect={() => onDelete()}>
            <Trash2 size={13} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function CollectionTree() {
  const { snapshot, openRequest, refresh } = useWorkspace();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const selectNode = useUiStore((state) => state.selectNode);
  const [search, setSearch] = useState("");
  const [deleteNode, setDeleteNode] = useState<VisibleTreeNode | null>(null);
  const [workspaceDialog, setWorkspaceDialog] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [importError, setImportError] = useState("");
  const expanded = useMemo(
    () => new Set(snapshot.settings.expandedNodeIds),
    [snapshot.settings.expandedNodeIds],
  );
  const rows = useMemo(
    () => visibleTree(snapshot.nodes, expanded, search),
    [expanded, search, snapshot.nodes],
  );
  const requestMap = useMemo(
    () => new Map(snapshot.requests.map((request) => [request.id, request])),
    [snapshot.requests],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 34,
    overscan: 10,
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const saveExpanded = async (ids: Set<string>) => {
    const settings = { ...snapshot.settings, expandedNodeIds: [...ids] };
    await api.updateSettings(settings);
    queryClient.setQueryData<WorkspaceSnapshot>(["snapshot"], {
      ...snapshot,
      settings,
    });
  };

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    void saveExpanded(next);
  };

  const createRequest = async () => {
    const parent = snapshot.nodes.find((node) => node.id === selectedNodeId && node.kind === "folder");
    const result = await api.createRequest(snapshot.selectedWorkspaceId, parent?.id ?? null);
    await refresh();
    selectNode(result.node.id);
    await openRequest(result.request);
  };

  const createFolder = async () => {
    const parent = snapshot.nodes.find((node) => node.id === selectedNodeId && node.kind === "folder");
    await api.createFolder(snapshot.selectedWorkspaceId, parent?.id ?? null, "New folder");
    await refresh();
  };

  const duplicateNode = async (node: VisibleTreeNode) => {
    const { rootId, nodes, requests } = cloneSubtree(snapshot, node);
    await api.importItems(snapshot.selectedWorkspaceId, nodes, requests);
    await refresh();
    const duplicated = nodes.find((item) => item.id === rootId);
    if (duplicated) {
      selectNode(duplicated.id);
      if (duplicated.requestId) {
        const request = requests.find((item) => item.id === duplicated.requestId);
        if (request) await openRequest(request);
      }
    }
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const target = snapshot.nodes.find((node) => node.id === over.id);
    const parentId = target?.kind === "folder" ? target.id : target?.parentId ?? null;
    if (!canMoveNode(snapshot.nodes, String(active.id), parentId)) return;
    const position = snapshot.nodes.filter((node) => node.parentId === parentId).length;
    await api.moveNode({ nodeId: String(active.id), parentId, position });
    if (parentId) {
      const next = new Set(expanded);
      next.add(parentId);
      await saveExpanded(next);
    }
    await refresh();
  };

  const switchWorkspace = async (workspaceId: string) => {
    const next = await api.getSnapshot(workspaceId);
    queryClient.setQueryData(["snapshot"], next);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setImportError("");
      const json = JSON.parse(await file.text());
      const isPostman = Boolean(json.info?._postman_id || Array.isArray(json.item));
      const result = isPostman
        ? importPostman(json, snapshot.selectedWorkspaceId)
        : importOpenApi(json, snapshot.selectedWorkspaceId);
      await api.importItems(snapshot.selectedWorkspaceId, result.nodes, result.requests);
      await refresh();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <aside className="collection-panel">
      <div className="workspace-select-row">
        <Select
          value={snapshot.selectedWorkspaceId}
          onValueChange={(workspaceId) => void switchWorkspace(workspaceId)}
        >
          <SelectTrigger className="workspace-select" aria-label={t("workspace")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {snapshot.workspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" title={t("createWorkspace")} onClick={() => setWorkspaceDialog(true)}>
          <Plus size={16} />
        </Button>
      </div>
      <div className="collection-actions">
        <Button size="compact" onClick={() => void createRequest()}><FileBraces size={14} />{t("request")}</Button>
        <Button size="compact" variant="ghost" onClick={() => void createFolder()} title={t("newFolder")}><FolderPlus size={15} /></Button>
        <label className="button button-ghost button-compact" title={t("importTitle")}>
          <Import size={15} /><span className="sr-only">{t("import")}</span>
          <input className="sr-only" type="file" accept=".json,application/json" onChange={(event) => void handleImport(event)} />
        </label>
      </div>
      <div className="search-wrap">
        <Search size={14} />
        <input className="input search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("search")} />
      </div>
      <div className="tree-scroll" ref={scrollRef} role="tree" aria-label={t("collection")}>
        {importError && <div className="response-error">{importError}</div>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void onDragEnd(event)}>
          <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const node = rows[virtualRow.index];
                return (
                  <div key={node.id} style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${virtualRow.start}px)` }}>
                    <SortableTreeRow
                      node={node}
                      request={node.requestId ? requestMap.get(node.requestId) : undefined}
                      expanded={expanded.has(node.id)}
                      selected={selectedNodeId === node.id}
                      onToggle={() => toggle(node.id)}
                      onOpen={() => {
                        selectNode(node.id);
                        if (node.requestId) {
                          const request = requestMap.get(node.requestId);
                          if (request) void openRequest(request);
                        }
                      }}
                      onDuplicate={() => void duplicateNode(node)}
                      onDelete={() => setDeleteNode(node)}
                    />
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <Dialog open={workspaceDialog} onOpenChange={setWorkspaceDialog} title={t("createWorkspace")} description={t("workspaceDescription")}>
        <label className="field-label" htmlFor="workspace-name">{t("workspaceName")}</label>
        <input id="workspace-name" className="input" autoFocus value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
        <div className="dialog-actions">
          <Button onClick={() => setWorkspaceDialog(false)}>{t("cancel")}</Button>
          <Button
            variant="primary"
            disabled={!workspaceName.trim()}
            onClick={async () => {
              const workspace = await api.createWorkspace(workspaceName.trim());
              setWorkspaceName("");
              setWorkspaceDialog(false);
              await switchWorkspace(workspace.id);
            }}
          >
            {t("create")}
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteNode)}
        onOpenChange={(open) => !open && setDeleteNode(null)}
        title={`Delete ${deleteNode?.name ?? "item"}?`}
        description={deleteNode?.kind === "folder" ? "This removes the folder and every request nested inside it. This cannot be undone." : "This removes the request and its saved tab. This cannot be undone."}
        confirmLabel={t("delete")}
        onConfirm={() => {
          if (!deleteNode) return;
          void api.deleteNode(deleteNode.id).then(refresh);
          setDeleteNode(null);
        }}
      />
    </aside>
  );
}
