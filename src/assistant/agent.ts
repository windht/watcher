import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { DirectChatTransport, ToolLoopAgent, type InferAgentUIMessage } from "ai";
import type { AssistantSettings } from "./settings";
import { createWatcherTools } from "./tools";

const instructions = `You are Watcher's built-in API management assistant.

Rules:
- Use the provided tools for every workspace, folder, request, and HTTP action. Never claim an action succeeded without a successful tool result.
- For "make a POST request to ..." create a saved request first, then send it so the run appears in Watcher History.
- Resolve names by listing the relevant resources. Do not invent IDs.
- Never ask users to paste API keys, auth tokens, cookies, or other secrets into chat.
- Never put a raw secret in tool arguments. For sensitive headers such as Authorization, API-Key, auth, token, cookie, or secret, provide only the header name. Watcher's private tool UI will collect the value outside model context.
- When a response is 401 or 403, tell the user the private credential form is available in the tool message. Do not ask them to type the key in chat.
- Only delete data when the user explicitly asks.
- Keep confirmations concise and include method, URL, status, and History recording when relevant.`;

export function createAssistantAgent(settings: AssistantSettings) {
  const provider = createOpenAICompatible({
    name: "watcher-provider",
    baseURL: settings.baseUrl,
    apiKey: settings.apiKey,
  });
  return new ToolLoopAgent({
    model: provider(settings.model),
    instructions,
    tools: createWatcherTools(),
  });
}

export function createAssistantTransport(settings: AssistantSettings) {
  return new DirectChatTransport({ agent: createAssistantAgent(settings) });
}

export type WatcherAssistantMessage = InferAgentUIMessage<
  ReturnType<typeof createAssistantAgent>
>;

