import { makeAutoObservable } from "mobx";
import { makePersistable } from "mobx-persist-store";
import localForage from "localforage";
import cuid from "cuid";

export const ROOT_ID = "_ROOT_ID";

interface ICollection {
  id: string;
  parent: string;
  text: string;
  droppable?: boolean;
  data: {
    type: string;
    requestId?: string;
    docId?: string;
  };
}

interface ISyncSetting {
  enabled: boolean;
  dataEncryptKey: string;
  type: "supabase";
  data: {
    url: string;
    key: string;
  };
}

interface IDirectory {
  id: string;
  name: string;
  collections: ICollection[];
  syncSetting?: ISyncSetting;
}

const DEFAULT_DIRECTORY = "__DEFAULT";

export class DirectoryStore {
  directoriesById: {
    [key: string]: IDirectory;
  } = {
    [DEFAULT_DIRECTORY]: {
      name: "My Default Space",
      id: DEFAULT_DIRECTORY,
      collections: [],
    },
  };

  selectedDirectoryId = DEFAULT_DIRECTORY;

  constructor() {
    makeAutoObservable(this);
    makePersistable(
      this,
      {
        name: "DirectoryStore",
        properties: ["directoriesById"],
        storage: localForage,
        stringify: false,
      },
      { delay: 200, fireImmediately: false }
    );
  }

  get directory() {
    return this.directoriesById[this.selectedDirectoryId];
  }

  get directories() {
    return Object.values(this.directoriesById);
  }

  setDirectoryCollections = (collections: ICollection[]) => {
    this.directory.collections = collections;
  };

  createCollection = (collection: ICollection) => {
    this.directory.collections = [...this.directory.collections, collection];
  };

  bulkCreateCollection = (collections: ICollection[]) => {
    this.directory.collections = [
      ...this.directory.collections,
      ...collections,
    ];
  };

  createDirectory = (name: string): string => {
    const newId = cuid();
    this.directoriesById[newId] = {
      id: newId,
      collections: [],
      name,
    };
    return newId;
  };

  selectDirectory = (id: string) => {
    this.selectedDirectoryId = id;
  };

  sync = () => {};
}

export const directoryStore = new DirectoryStore();
