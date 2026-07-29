import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { DirectChatTransport, ToolLoopAgent, type InferAgentUIMessage } from "ai";
import type { AssistantSettings } from "./settings";
import { createWatcherTools } from "./tools";
import { fetchAssistantRequest } from "./http";
import { normalizeAssistantBaseUrl } from "./settings";

const instructions = `You are Watcher's built-in API management assistant.

Rules:
- Use the provided tools for every workspace, folder, request, and HTTP action. Never claim an action succeeded without a successful tool result.
- For "make a POST request to ..." create a saved request first, then send it so the run appears in Watcher History.
- Create SSE and WebSocket requests with transport "sse" or "websocket". Call send_request to start their live connection, get_realtime_events to inspect it, send_realtime_message only for a connected WebSocket, and disconnect_realtime when the user asks to stop.
- Realtime connections are interactive desktop sessions, so their live event log is shown in Realtime rather than recorded as one HTTP History entry.
- Resolve names by listing the relevant resources. Do not invent IDs.
- Never ask users to paste API keys, auth tokens, cookies, or other secrets into chat.
- Never put a raw secret in tool arguments. For sensitive headers such as Authorization, API-Key, auth, token, cookie, or secret, provide only the header name. Watcher's private tool UI will collect the value outside model context.
- When a response is 401 or 403, tell the user the private credential form is available in the tool message. Do not ask them to type the key in chat.
- Keep each conversation title useful: if the user gives the conversation a name, call name_the_thread with that name. Otherwise the local UI titles it from the first user message.
- Only delete data when the user explicitly asks.
- Keep confirmations concise and include method, URL, status, and History recording when relevant.`;

function assistantErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: unknown; cause?: unknown };
    if (typeof candidate.message === "string" && candidate.message) return candidate.message;
    if (typeof candidate.cause === "string" && candidate.cause) return candidate.cause;
    try {
      return JSON.stringify(error);
    } catch {
      return "The assistant provider returned an unreadable error.";
    }
  }
  return "The assistant request failed before a response was received.";
}

export function createAssistantAgent(settings: AssistantSettings) {
  const provider = createOpenAICompatible({
    name: "watcher-provider",
    baseURL: normalizeAssistantBaseUrl(settings.baseUrl),
    apiKey: settings.apiKey,
    fetch: fetchAssistantRequest,
  });
  return new ToolLoopAgent({
    model: provider(settings.model),
    instructions,
    tools: createWatcherTools(),
  });
}

export function createAssistantTransport(settings: AssistantSettings) {
  return new DirectChatTransport({ agent: createAssistantAgent(settings), onError: assistantErrorMessage });
}

export type WatcherAssistantMessage = InferAgentUIMessage<
  ReturnType<typeof createAssistantAgent>
>;
