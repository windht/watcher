import { create } from "zustand";
import type { HttpExecutionResult, RequestDraft } from "../types";

interface UiState {
  collectionCollapsed: boolean;
  selectedNodeId: string | null;
  drafts: Record<string, RequestDraft>;
  responses: Record<string, HttpExecutionResult>;
  toggleCollection: () => void;
  selectNode: (id: string | null) => void;
  setDraft: (requestId: string, draft: RequestDraft) => void;
  clearDraft: (requestId: string) => void;
  setResponse: (requestId: string, response: HttpExecutionResult) => void;
}

export const useUiStore = create<UiState>((set) => ({
  collectionCollapsed: false,
  selectedNodeId: null,
  drafts: {},
  responses: {},
  toggleCollection: () => set((state) => ({ collectionCollapsed: !state.collectionCollapsed })),
  selectNode: (id) => set({ selectedNodeId: id }),
  setDraft: (requestId, draft) =>
    set((state) => ({ drafts: { ...state.drafts, [requestId]: draft } })),
  clearDraft: (requestId) =>
    set((state) => {
      const drafts = { ...state.drafts };
      delete drafts[requestId];
      return { drafts };
    }),
  setResponse: (requestId, response) =>
    set((state) => ({ responses: { ...state.responses, [requestId]: response } })),
}));
