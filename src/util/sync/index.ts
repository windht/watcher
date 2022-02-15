import { supbaseSync } from "./supabase";

export class Syncer {
  init = (...args: any) => {};
  pull = (id: string) => {};
  push = (id: string, data: any) => {};
}

export const syncer = {
  supabase: supbaseSync,
};
