import { makeAutoObservable } from "mobx";
import { makePersistable } from "mobx-persist-store";
import localForage from "localforage";
import { IRequest } from "./RequestStore";

interface IHistory {
  createdAt: number;
  request: IRequest;
}

export class HistoryStore {
  histories: IHistory[] = [];

  constructor() {
    makeAutoObservable(this);
    makePersistable(
      this,
      {
        name: "HistoryStore",
        properties: ["histories"],
        storage: localForage,
        stringify: false,
      },
      { delay: 200, fireImmediately: false }
    );
  }

  addHistory = (request: IRequest) => {
    this.histories.push({
      request,
      createdAt: new Date().getTime(),
    });
  };
}

export const historyStore = new HistoryStore();
