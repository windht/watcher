import { makeAutoObservable, reaction, toJS } from "mobx";
import { makePersistable } from "mobx-persist-store";
import localForage from "localforage";
import cuid from "cuid";
import * as CryptoJS from "crypto-js";
import { syncer } from "util/sync";

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

interface ISyncSetting {
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
  key: string;
  initial_value: string;
  current_value: string;
}

interface IDirectory {
  id: string;
  name: string;
  collections: ICollection[];
  syncSetting?: ISyncSetting;
  environmentVariables?: IEnvironmentVariable[];
  version: number;
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
    },
  };

  directoriesLoading: {
    [key: string]: boolean;
  } = {};

  selectedDirectoryId = DEFAULT_DIRECTORY;

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
      ...this.directory,
      collections: [...this.directory.collections, collection],
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
        collections: data.collections || {},
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
      },
    };

    await this.sync(this.directoriesById[id]);

    return id;
  };
}

export const directoryStore = new DirectoryStore();
