import { AssistantModalPrimitive } from "@assistant-ui/react";
import { Bot, ChevronDown } from "lucide-react";
import { AssistantThread } from "./thread";

export function AssistantModal() {
  return (
    <AssistantModalPrimitive.Root unstable_openOnRunStart>
      <AssistantModalPrimitive.Trigger asChild>
        <button type="button" className="assistant-trigger" aria-label="Toggle Watcher assistant" title="Watcher Assistant">
          <Bot className="assistant-open-icon" size={22} />
          <ChevronDown className="assistant-close-icon" size={22} />
        </button>
      </AssistantModalPrimitive.Trigger>
      <AssistantModalPrimitive.Content side="top" align="end" sideOffset={12} className="assistant-modal">
        <header>
          <div><span>WATCHER</span><strong>API Assistant</strong></div>
          <small>Agent-native, local-first</small>
        </header>
        <AssistantThread />
      </AssistantModalPrimitive.Content>
    </AssistantModalPrimitive.Root>
  );
}

