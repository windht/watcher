import { fetch as nativeFetch } from "@tauri-apps/plugin-http";
import { isTauriRuntime } from "../lib/utils";

export function fetchAssistantRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  return isTauriRuntime()
    ? nativeFetch(input, init)
    : globalThis.fetch(input, init);
}
