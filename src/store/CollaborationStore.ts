import { syncedStore, getYjsValue } from "@syncedstore/core";
import { makeObservable, observable } from "mobx";
import { WebrtcProvider } from "y-webrtc";
import { ISyncSetting } from "./DirectoryStore";

export class CollaborationStore {
  webrtcProvider: WebrtcProvider | undefined;
  synced: any = syncedStore({ userStates: {}, fragment: "xml" });
  peers = {};

  constructor() {
    makeObservable(this, {
      peers: observable,
    });
    this.init();
  }
  init = () => {};

  setupProvider = (syncSettings: ISyncSetting) => {
    if (this.webrtcProvider) {
      this.cleanWebrtc();
    }

    this.synced = syncedStore({ userStates: {}, fragment: "xml" });
    const doc = getYjsValue(this.synced);
    this.webrtcProvider = new WebrtcProvider(
      syncSettings.uuid,
      doc as any,
      {
        signaling: [
          "wss://signaling.yjs.dev",
          "wss://y-webrtc-signaling-eu.herokuapp.com",
          "wss://y-webrtc-signaling-us.herokuapp.com",
        ],
        password: syncSettings.dataEncryptKey,
        maxConns: Number.POSITIVE_INFINITY,
        filterBcConns: false,
      } as any
    );
    (window as any).webrtcProvider = this.webrtcProvider;

    this.webrtcProvider.on("peers", (data: any) => {
      this.peers = data;
    });
  };

  cleanWebrtc = () => {
    this.webrtcProvider?.destroy();
    this.webrtcProvider?.disconnect();
  };

  disconnect = () => this.webrtcProvider?.disconnect();

  connect = () => this.webrtcProvider?.connect();
}

export const collaborationStore = new CollaborationStore();
