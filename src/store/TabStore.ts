import { makeAutoObservable } from "mobx";
import { makePersistable } from "mobx-persist-store";
import localForage from "localforage";

interface ITab {
  id: string;
  type: string;
  requestId: string;
  data: any;
}

export class TabStore {
  tabsById: {
    [key: string]: ITab;
  } = {};
  tabs: string[] = [];

  constructor() {
    makeAutoObservable(this);
  }
}

export const directoryStore = new TabStore();
