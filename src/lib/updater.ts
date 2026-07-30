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

export interface UpdateDiagnostic {
  message: string;
  timestamp: number;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useUpdater() {
  const [status, setStatus] = useState<UpdateState>({ state: "idle" });
  const [diagnostics, setDiagnostics] = useState<UpdateDiagnostic[]>([]);

  const record = useCallback((message: string) => {
    setDiagnostics((entries) => [...entries.slice(-7), { message, timestamp: Date.now() }]);
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (!isTauriRuntime()) {
      setStatus({ state: "current" });
      record("Update checks are available in the Watcher desktop app.");
      return;
    }
    setStatus({ state: "checking" });
    record("Checking GitHub for a signed update.");
    try {
      const update = await check({ timeout: 10_000 });
      setStatus(update ? { state: "available", update } : { state: "current" });
      record(update ? `Watcher ${update.version} is ready to install.` : "Watcher is already up to date.");
    } catch (error) {
      const message = errorMessage(error);
      setStatus({ state: "error", message });
      record(`Update check failed: ${message}`);
    }
  }, [record]);

  const install = useCallback(async () => {
    if (status.state !== "available") {
      record("Install was not started because no update is ready. Check for updates again.");
      return;
    }
    const update = status.update;
    let downloaded = 0;
    let total = 0;
    setStatus({ state: "downloading", update, progress: 0 });
    record(`Starting download for Watcher ${update.version}.`);
    try {
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          record(total ? `Download started (${total} bytes).` : "Download started.");
        }
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setStatus({ state: "downloading", update, progress: total ? downloaded / total : 0 });
        }
        if (event.event === "Finished") {
          setStatus({ state: "installing" });
          record("Download complete. Installing the update.");
        }
      });
      setStatus({ state: "installing" });
      record("Update installed. Requesting Watcher relaunch.");
      await relaunch();
    } catch (error) {
      const message = errorMessage(error);
      setStatus({ state: "error", message });
      record(`Update installation failed: ${message}`);
    }
  }, [record, status]);

  return { status, diagnostics, checkForUpdate, install };
}
