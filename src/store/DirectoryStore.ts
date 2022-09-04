import { makeAutoObservable, reaction, toJS } from "mobx";
import { makePersistable } from "mobx-persist-store";
import localForage from "localforage";
import cuid from "cuid";
import * as CryptoJS from "crypto-js";
import { syncer } from "util/sync";
import { IRequest } from "types/request";
import { EMPTY_REQUEST } from "const";

export const ROOT_ID = "_ROOT_ID";

export interface ICollection {
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

export interface ISyncSetting {
  uuid: string;
  enabled: boolean;
  dataEncryptKey: string;
  type: "supabase";
  data: {
    url: string;
    key: string;
  };
  version: number;
}

interface IEnvironmentVariable {
  active: boolean;
  key: string;
  initial_value: string;
  current_value: string;
}

export interface IDirectory {
  id: string;
  name: string;
  collections: ICollection[];
  syncSetting?: ISyncSetting;
  environmentVariables?: IEnvironmentVariable[];
  version: number;
  requestsById: { [key: string]: IRequest };
}

const DEFAULT_DIRECTORY = "__DEFAULT";

const SYNC_INTERVAL = 30 * 1000;

export class DirectoryStore {
  directoriesById: {
    [key: string]: IDirectory;
  } = {
    [DEFAULT_DIRECTORY]: {
      name: "My Default Space",
      id: DEFAULT_DIRECTORY,
      collections: [],
      environmentVariables: [],
      version: 1,
      requestsById: {},
    },
  };

  directoriesLoading: {
    [key: string]: boolean;
  } = {};

  selectedDirectoryId = DEFAULT_DIRECTORY;

  selectedRequestId: string | undefined;

  constructor() {
    makeAutoObservable(this);
    makePersistable(
      this,
      {
        name: "DirectoryStore",
        properties: ["directoriesById", "selectedDirectoryId"],
        storage: localForage,
        stringify: false,
      },
      { delay: 200, fireImmediately: false }
    ).then(() => {
      this.init();
    });

    reaction(
      () => this.directory,
      (currentDirectory, prevDirectory) => {
        // console.log("Change in directory", currentDirectory, prevDirectory);
        if (
          currentDirectory.id === prevDirectory.id &&
          currentDirectory.version === prevDirectory.version
        ) {
          this.directoriesById[this.selectedDirectoryId].version += 1;
        }
      }
    );
  }

  init = () => {
    this.syncAll();
    setInterval(() => {
      this.syncAll();
    }, SYNC_INTERVAL);
  };

  syncAll = () => {
    this.directories.forEach((directory) => {
      this.sync(directory);
    });
  };

  get directory() {
    return this.directoriesById[this.selectedDirectoryId];
  }

  get directories() {
    return Object.values(this.directoriesById);
  }

  setDirectoryCollections = (collections: ICollection[]) => {
    this.directoriesById[this.selectedDirectoryId] = {
      ...this.directory,
      collections: collections,
    };
  };

  createCollection = (collection: ICollection) => {
    this.directoriesById[this.selectedDirectoryId] = {
      ...this.directoriesById[this.selectedDirectoryId],
      collections: [
        ...this.directoriesById[this.selectedDirectoryId].collections,
        collection,
      ],
    };
  };

  addRequestToDirectory = (request: IRequest) => {
    this.directoriesById[this.selectedDirectoryId] = {
      ...this.directoriesById[this.selectedDirectoryId],
      requestsById: {
        ...this.directoriesById[this.selectedDirectoryId].requestsById,
        [request.id]: request,
      },
    };
  };

  createRequestInCollection = (parent: string) => {
    const request = {
      ...EMPTY_REQUEST,
      id: cuid(),
    };
    const collection = {
      id: cuid(),
      text: request.name,
      droppable: false,
      parent,
      data: {
        type: "request",
        requestId: request.id,
      },
    };
    this.directoriesById[this.selectedDirectoryId] = {
      ...this.directory,
      collections: [...this.directory.collections, collection],
      requestsById: {
        ...this.directoriesById[this.selectedDirectoryId].requestsById,
        [request.id]: request,
      },
    };
  };

  bulkCreateCollection = (collections: ICollection[]) => {
    this.directoriesById[this.selectedDirectoryId] = {
      ...this.directory,
      collections: [...this.directory.collections, ...collections],
    };
  };

  createDirectory = (name: string): string => {
    const newId = cuid();
    this.directoriesById = {
      ...this.directoriesById,
      [newId]: {
        id: newId,
        collections: [],
        name,
        version: 1,
        requestsById: {},
      },
    };
    return newId;
  };

  selectDirectory = (id: string) => {
    this.selectedDirectoryId = id;
  };

  updateDirectory = (diretory: Partial<IDirectory>) => {
    this.directoriesById[this.selectedDirectoryId] = {
      ...this.directoriesById[this.selectedDirectoryId],
      ...diretory,
    };
  };

  removeCollectionById = (id: string) => {
    this.directoriesById[this.selectedDirectoryId] = {
      ...this.directoriesById[this.selectedDirectoryId],
      collections: this.directoriesById[
        this.selectedDirectoryId
      ].collections.filter((collection) => collection.id !== id),
    };

    const newRequestById = {
      ...this.directoriesById[this.selectedDirectoryId].requestsById,
    };
    delete newRequestById[id];
    this.directoriesById[this.selectedDirectoryId].requestsById = {
      ...newRequestById,
    };
  };

  pull = async (directory: IDirectory) => {
    if (directory.syncSetting) {
      const raw = (await syncer.supabase.pull(
        directory.syncSetting.uuid
      )) as any;
      let data = raw.data;
      const version = raw.version;

      if (data) {
        data = JSON.parse(
          CryptoJS.AES.decrypt(
            data,
            directory.syncSetting.dataEncryptKey
          ).toString(CryptoJS.enc.Utf8)
        );
      }

      return {
        collections: data.collections || [],
        requestsById: data.requestsById || {},
        name: data.name,
        environmentVariables: data.environmentVariables,
        version,
      };
    }
  };

  push = async (directory: IDirectory) => {
    if (directory.syncSetting) {
      directory.version += 1;
      const dataString = JSON.stringify({
        collections: toJS(directory.collections),
        name: toJS(directory.name),
        environmentVariables: toJS(directory.environmentVariables),
        requestsById: toJS(directory.requestsById),
      });
      const dataToSend = CryptoJS.AES.encrypt(
        dataString,
        directory.syncSetting.dataEncryptKey
      ).toString();
      await syncer.supabase.push(
        directory.syncSetting.uuid,
        dataToSend,
        directory.version
      );
    }
  };

  sync = async (directory: IDirectory) => {
    if (directory.syncSetting) {
      try {
        this.setIsSyncing(directory.id, true);
        await syncer.supabase.init(directory.syncSetting.data);
        const pulled: any = await this.pull(directory);
        const localVersion = directory.version || 1;
        const remoteVersion = pulled.version || 0;
        console.log("RemoteVersion", remoteVersion);
        console.log("LocalVersion", localVersion);
        console.log("Pulled", pulled);
        if (remoteVersion > localVersion) {
          console.log("RemoteVersion larger than localVersion, pulling");
          this.updateDirectoryById(directory.id, {
            ...directory,
            ...pulled,
          });
        } else if (remoteVersion < localVersion) {
          console.log("RemoteVersion smaller than localVersion, pushing");
          await this.push(directory);
        } else {
          console.log("Version same");
        }
      } finally {
        this.setIsSyncing(directory.id, false);
      }
    }
  };

  updateDirectoryById = (id: string, diretory: Partial<IDirectory>) => {
    if (id) {
      this.directoriesById[id] = {
        ...this.directoriesById[id],
        ...diretory,
      };
    }
  };

  setIsSyncing = (id: string, boolean = true) => {
    this.directoriesLoading = {
      ...this.directoriesLoading,
      [id]: boolean,
    };
  };

  createFromSync = async (syncString: string) => {
    const syncSetting = JSON.parse(atob(syncString));
    const id = cuid();

    this.directoriesById = {
      ...this.directoriesById,
      [id]: {
        id,
        collections: [],
        name: "Synced Spaces",
        version: 0,
        syncSetting,
        requestsById: {},
      },
    };

    await this.sync(this.directoriesById[id]);

    return id;
  };

  // Requests

  selectRequest = (id?: string) => {
    this.selectedRequestId = id;
  };

  get selectedRequest() {
    return this.selectedRequestId
      ? this.directory.requestsById[this.selectedRequestId]
      : undefined;
  }

  updateRequest = (request: IRequest) => {
    this.directoriesById[this.selectedDirectoryId] = {
      ...this.directory,
      requestsById: {
        ...this.directoriesById[this.selectedDirectoryId].requestsById,
        [request.id]: {
          ...this.directoriesById[this.selectedDirectoryId].requestsById[
            request.id
          ],
          ...request,
        },
      },
    };
  };

  preRequestScript = async (request: IRequest) => {
    if (request.preRequestScript) {
      // eslint-disable-next-line
      const watcher = this.getWatcherUtil();
      // eslint-disable-next-line
      eval(request.preRequestScript);
    }
  };

  afterRequestScript = async (request: IRequest, response: any) => {
    if (request.afterRequestScript) {
      // eslint-disable-next-line
      const watcher = this.getWatcherUtil();
      // eslint-disable-next-line
      eval(request.afterRequestScript);
    }
  };

  getWatcherUtil = () => {
    return {
      environment: {
        set: this.setEnvironmentVariable,
        get: this.getEnvironmentVariable,
      },
    };
  };

  getEnvironmentVariable = (key: string) => {
    return (this.directory.environmentVariables || []).find(
      (variable) => variable.key === key
    );
  };

  setEnvironmentVariable = (key: string, value: string) => {
    const environmentVariables = [
      ...(this.directory.environmentVariables || []),
    ];
    const existingIndex = environmentVariables.findIndex(
      (variable) => variable.key === key
    );
    if (existingIndex !== -1) {
      environmentVariables[existingIndex].current_value = value;
      this.updateDirectory({
        environmentVariables,
      });
    } else {
      this.updateDirectory({
        environmentVariables: [
          ...environmentVariables,
          {
            active: true,
            key,
            initial_value: "",
            current_value: value,
          },
        ],
      });
    }
  };
}

export const directoryStore = new DirectoryStore();
