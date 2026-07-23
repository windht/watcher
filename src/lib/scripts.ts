import type { ScriptContext, ScriptResult } from "../types";

export function runScript(
  code: string,
  context: ScriptContext,
  timeoutMs = 2_000,
): Promise<ScriptResult> {
  if (!code.trim()) return Promise.resolve({ ...context, logs: [] });

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./script.worker.ts", import.meta.url), {
      type: "module",
    });
    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error(`Script exceeded the ${timeoutMs}ms limit.`));
    }, timeoutMs);

    worker.onmessage = (
      event: MessageEvent<
        { ok: true; result: ScriptResult } | { ok: false; error: string }
      >,
    ) => {
      window.clearTimeout(timer);
      worker.terminate();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      window.clearTimeout(timer);
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage({ code, context });
  });
}
