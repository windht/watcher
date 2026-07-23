import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useState } from "react";
import { isTauriRuntime } from "./utils";

export type UpdateState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; update: Update }
  | { state: "current" }
  | { state: "downloading"; update: Update; progress: number }
  | { state: "installing" }
  | { state: "error"; message: string };

export function useUpdater() {
  const [status, setStatus] = useState<UpdateState>({ state: "idle" });

  const checkForUpdate = useCallback(async () => {
    if (!isTauriRuntime()) {
      setStatus({ state: "current" });
      return;
    }
    setStatus({ state: "checking" });
    try {
      const update = await check({ timeout: 10_000 });
      setStatus(update ? { state: "available", update } : { state: "current" });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  const install = useCallback(async () => {
    if (status.state !== "available") return;
    const update = status.update;
    let downloaded = 0;
    let total = 0;
    try {
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setStatus({ state: "downloading", update, progress: total ? downloaded / total : 0 });
        }
        if (event.event === "Finished") setStatus({ state: "installing" });
      });
      await relaunch();
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }, [status]);

  return { status, checkForUpdate, install };
}
