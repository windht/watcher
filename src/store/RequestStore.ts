import { Method } from "axios";
import { makeAutoObservable } from "mobx";
import { makePersistable } from "mobx-persist-store";
import localForage from "localforage";
import cuid from "cuid";
import { EMPTY_REQUEST } from "const";

interface IHeader {
  active: boolean;
  key: string;
  value: string;
  description: string;
}

interface IParams {
  active: boolean;
  key: string;
  value: string;
  description: string;
}

export interface IRequest {
  id: string;
  name: string;
  url: string;
  method: Method;
  headers: IHeader[];
  data: any;
  bodyType: any;
  params: IParams[];
}

export class RequestStore {
  selectedRequestId: string | undefined;

  requestsById: {
    [key: string]: IRequest;
  } = {};

  constructor() {
    makeAutoObservable(this);
    makePersistable(
      this,
      {
        name: "RequestStore",
        properties: ["requestsById"],
        storage: localForage,
        stringify: false,
      },
      { delay: 2000, fireImmediately: false }
    );
  }

  createNewRequest = (request: IRequest) => {
    this.requestsById[request.id] = { ...request };
  };

  getNewRequest = () => {
    const id = cuid();
    this.requestsById[id] = { ...EMPTY_REQUEST, id };
    return this.requestsById[id];
  };

  selectRequest = (id?: string) => {
    this.selectedRequestId = id;
  };

  updateRequest = (request: IRequest) => {
    this.requestsById[request.id] = { ...request };
  };

  get selectedRequest() {
    return this.selectedRequestId
      ? this.requestsById[this.selectedRequestId]
      : undefined;
  }
}

export const requestStore = new RequestStore();
