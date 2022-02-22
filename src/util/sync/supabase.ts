import { createClient, SupabaseClient } from "@supabase/supabase-js";

class SupabaseSync {
  client: SupabaseClient | undefined;
  init = ({ url, key }: any) => {
    this.client = createClient(url, key);
  };
  pull = async (id: string) => {
    const workspace = await this.client
      ?.from("workspace")
      .select(`id, data, version`)
      .eq("id", id);

    return (
      workspace?.data?.[0] || {
        version: 0,
        data: "",
      }
    );
  };
  push = async (id: string, data: any, version: number) => {
    await this.client?.from("workspace").upsert({ id, data, version });
  };
  sync = async (id: string, data: any) => {};
}

export const supbaseSync = new SupabaseSync();
