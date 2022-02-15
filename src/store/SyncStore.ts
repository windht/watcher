import { makeAutoObservable } from "mobx";
import { makePersistable } from "mobx-persist-store";
import localForage from "localforage";

export class SyncStore {
  constructor() {
    makeAutoObservable(this);
    makePersistable(
      this,
      {
        name: "SyncStore",
        properties: [],
        storage: localForage,
        stringify: false,
      },
      { delay: 200, fireImmediately: false }
    );
  }
}

export const syncStore = new SyncStore();
