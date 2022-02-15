import { languages } from "i18n";
import { makeAutoObservable } from "mobx";

export class ConfigStore {
  language: "en-US" | "zh-CN" ='en-US';

  constructor() {
    makeAutoObservable(this);
    this.init();
  }
  init = () => {
    this.initLanguage();
  };

  initLanguage = () => {
   const languageFromStorage = (localStorage.getItem("language") as any);
   const languageFromBrowser = !!(languages as any)[navigator.language] ? navigator.language : 'en-US';
   this.language = languageFromStorage || languageFromBrowser;
  }

  setLanguage = (language: any) => {
    this.language = language;
    localStorage.setItem("language", language);
  };
}

export const configStore = new ConfigStore();
