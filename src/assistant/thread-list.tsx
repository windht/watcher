import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useAssistantRuntime, useAuiState } from "@assistant-ui/react";

const MAX_TITLE_LENGTH = 50;

function messageText(message: { content?: readonly { type?: string; text?: string }[] } | undefined) {
  return message?.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join(" ").trim() ?? "";
}

function shorten(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > MAX_TITLE_LENGTH ? `${compact.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : compact;
}

export function AssistantThreadList() {
  const runtime = useAssistantRuntime();
  const threads = useAuiState((state) => state.threads);
  const current = useAuiState((state) => state.threadListItem);
  const messages = useAuiState((state) => state.thread.messages);
  const ids = Array.from(new Set([...(threads.threadIds ?? []), ...(threads.newThreadId ? [threads.newThreadId] : []), current.id]));
  const items = ids.map((id) => ({
    id,
    title: id === current.id ? current.title : threads.threadItems.find((item) => item.id === id)?.title,
  }));

  useEffect(() => {
    const rename = (event: Event) => {
      const name = (event as CustomEvent<{ name?: unknown }>).detail?.name;
      if (typeof name !== "string" || !name.trim()) return;
      void runtime.threads.mainItem.rename(name.trim().slice(0, 80)).catch(() => undefined);
    };
    window.addEventListener("watcher:assistant-thread-renamed", rename);
    return () => window.removeEventListener("watcher:assistant-thread-renamed", rename);
  }, [runtime]);

  useEffect(() => {
    if (current.title?.trim()) return;
    const firstUserMessage = messages.find((message) => message.role === "user");
    const title = shorten(messageText(firstUserMessage));
    if (title) void runtime.threads.mainItem.rename(title).catch(() => undefined);
  }, [current.title, messages, runtime]);

  return (
    <aside className="assistant-thread-list" aria-label="Assistant conversations">
      <div className="assistant-thread-list-heading">
        <span>Threads</span>
        <button type="button" className="assistant-thread-new" onClick={() => void runtime.threads.switchToNewThread()} aria-label="New thread" title="New thread"><Plus size={14} /></button>
      </div>
      <div className="assistant-thread-items">
        {items.length === 0 ? <span className="assistant-thread-empty">No conversations yet.</span> : items.map((item) => {
          const title = item.title?.trim() || "New Thread";
          return (
            <div
              key={item.id}
              className={`assistant-thread-row ${item.id === current.id ? "active" : ""}`}
            >
              <button
                type="button"
                className="assistant-thread-item"
                onClick={() => item.id === current.id ? undefined : void runtime.threads.switchToThread(item.id)}
              >
                <MessageSquare size={13} />
                <span>{title}</span>
              </button>
              <button
                type="button"
                className="assistant-thread-delete"
                aria-label={`Delete thread "${title}"`}
                title="Delete thread"
                onClick={() => void runtime.threads.getItemById(item.id).delete()}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
