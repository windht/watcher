import { createContext, useContext } from "react";
import { AuthStore, authStore } from "./AuthStore";
import { CollaborationStore, collaborationStore } from "./CollaborationStore";
import { ConfigStore, configStore } from "./ConfigStore";
import { DirectoryStore, directoryStore } from "./DirectoryStore";
import { HistoryStore, historyStore } from "./HistoryStore";
import { TabStore, tabStore } from "./TabStore";

export interface RootStore {
  configStore: ConfigStore;
  directoryStore: DirectoryStore;
  historyStore: HistoryStore;
  tabStore: TabStore;
  collaborationStore: CollaborationStore;
  authStore: AuthStore;
}

export const rootStore: RootStore = {
  configStore,
  directoryStore,
  historyStore,
  tabStore,
  collaborationStore,
  authStore,
};

export const RootContext = createContext<RootStore>(rootStore);

export const useStore = (): RootStore => {
  const store = useContext(RootContext);
  return store;
};

(window as any).rootStore = rootStore;
