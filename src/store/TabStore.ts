import { makeAutoObservable } from "mobx";
import { makePersistable } from "mobx-persist-store";
import localForage from "localforage";

export enum TabStatusEnum {
  DIRTY = "DIRTY",
  NEW = "NEW",
  STATIC = "STATIC",
}

export interface ITab {
  id: string;
  type: string;
  data: any;
  currentData: any;
  status: TabStatusEnum;
}
export class TabStore {
  tabsByDirectoryId: {
    [key: string]: {
      tabs: string[];
      tabsById: {
        [key: string]: ITab;
      };
    };
  } = {};

  selectedTabId: string | undefined;

  constructor() {
    makeAutoObservable(this);
    makePersistable(
      this,
      {
        name: "TabStore",
        properties: ["tabsByDirectoryId", "selectedTabId"],
        storage: localForage,
        stringify: false,
      },
      { delay: 200, fireImmediately: false }
    ).then(() => {
      this.init();
    });
  }

  updateTabsArray = (directoryId: string, tabs: string[]) => {
    this.ensureDirectory(directoryId);
    this.tabsByDirectoryId[directoryId].tabs = tabs;
  };

  updateTabsMap = (directoryId: string, id: string, tab: ITab) => {
    this.ensureDirectory(directoryId);
    this.tabsByDirectoryId[directoryId].tabsById[id] = tab;
  };

  removeTabsMap = (directoryId: string, id: string) => {
    delete this.tabsByDirectoryId[directoryId].tabsById[id];
  };

  setSelectedTabId = (id: string | undefined) => {
    this.selectedTabId = id;
  };

  ensureDirectory = (directoryId: string) => {
    if (!this.tabsByDirectoryId[directoryId]) {
      this.tabsByDirectoryId[directoryId] = {
        tabs: [],
        tabsById: {},
      };
    }
  };

  init = () => {};
}

export const tabStore = new TabStore();
