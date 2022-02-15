import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Syncer } from "./index";

class SupabaseSync extends Syncer {
  client: SupabaseClient | undefined;
  init = ({ url, key }: any) => {
    this.client = createClient(url, key);
  };
  pull = async (id: string) => {
    const workspace = await this.client
      ?.from("workspace")
      .select(`id, data`)
      .eq("id", id);
    return workspace?.data;
  };
  push = async (id: string, data: any) => {
    await this.client?.from("workspace").upsert({ id, data });
  };
  sync = async (id: string, data: any) => {};
}

export const supbaseSync = new SupabaseSync();
