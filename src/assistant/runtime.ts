import { useMemo } from "react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import type { AssistantSettings } from "./settings";
import { createAssistantTransport, type WatcherAssistantMessage } from "./agent";

export function useWatcherAssistantRuntime(settings: AssistantSettings) {
  const { apiKey, baseUrl, model } = settings;
  const transport = useMemo(
    () => createAssistantTransport({ apiKey, baseUrl, model }),
    [apiKey, baseUrl, model],
  );
  return useChatRuntime<WatcherAssistantMessage>({ transport });
}
