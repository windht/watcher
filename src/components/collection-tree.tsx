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
  FileBraces,
  Folder,
  FolderOpen,
  FolderPlus,
  Import,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { api } from "../lib/api";
import { importOpenApi, importPostman } from "../lib/importers";
import { canMoveNode, visibleTree, type VisibleTreeNode } from "../lib/tree";
import { cn } from "../lib/utils";
import { useUiStore } from "../store/ui";
import type { ApiRequest, WorkspaceSnapshot } from "../types";
import { useWorkspace } from "../workspace-context";
import { Button, ConfirmDialog, Dialog } from "./ui";
import { useI18n } from "../i18n";

const methodClass = (method?: string) =>
  `method-${(method ?? "get").toLowerCase()}`;

function SortableTreeRow({
  node,
  request,
  expanded,
  selected,
  onToggle,
  onOpen,
  onDelete,
}: {
  node: VisibleTreeNode;
  request?: ApiRequest;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const sortable = useSortable({ id: node.id });
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
          <span className={cn("tree-method", methodClass(request?.method))}>
            {request?.method.slice(0, 6)}
          </span>
        </>
      )}
      <span className="tree-name">{node.name}</span>
      <button
        className="tree-toggle tree-more"
        aria-label={`Delete ${node.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <MoreHorizontal size={14} />
      </button>
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
        <select
          className="workspace-select"
          value={snapshot.selectedWorkspaceId}
          onChange={(event) => void switchWorkspace(event.target.value)}
          aria-label={t("workspace")}
        >
          {snapshot.workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
          ))}
        </select>
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
        onConfirm={() => {
          if (!deleteNode) return;
          void api.deleteNode(deleteNode.id).then(refresh);
          setDeleteNode(null);
        }}
      />
    </aside>
  );
}
