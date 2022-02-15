import { createContext, useContext } from "react";
import { ConfigStore, configStore } from "./ConfigStore";
import { DirectoryStore, directoryStore } from "./DirectoryStore";
import { HistoryStore, historyStore } from "./HistoryStore";
import { RequestStore, requestStore } from "./RequestStore";

export interface RootStore {
  requestStore: RequestStore;
  configStore: ConfigStore;
  directoryStore: DirectoryStore;
  historyStore: HistoryStore;
}

export const rootStore: RootStore = {
  requestStore,
  configStore,
  directoryStore,
  historyStore,
};

export const RootContext = createContext<RootStore>(rootStore);

export const useStore = (): RootStore => {
  const store = useContext(RootContext);
  return store;
};

(window as any).rootStore = rootStore;
