import { makeAutoObservable } from "mobx";

export class AuthStore {
  constructor() {
    makeAutoObservable(this);
    this.init();
  }
  init = () => {};
}

export const authStore = new AuthStore();
