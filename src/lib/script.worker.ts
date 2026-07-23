/// <reference lib="webworker" />
import type { ScriptContext, ScriptResult } from "../types";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<{ code: string; context: ScriptContext }>) => {
  const { code, context } = event.data;
  const environment = { ...context.environment };
  const logs: string[] = [];
  const watcher = {
    environment: {
      get: (key: string) => environment[key],
      set: (key: string, value: unknown) => {
        environment[key] = String(value);
      },
    },
    log: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
  };

  try {
    const run = new Function(
      "watcher",
      "request",
      "response",
      `"use strict";\n${code}`,
    );
    run(watcher, context.request, context.response);
    const result: ScriptResult = {
      request: context.request,
      response: context.response,
      environment,
      logs,
    };
    self.postMessage({ ok: true, result });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
