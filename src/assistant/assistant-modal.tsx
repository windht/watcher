import { AssistantModalPrimitive, useAssistantRuntime } from "@assistant-ui/react";
import { Bot, ChevronDown, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { AssistantThread } from "./thread";
import { AssistantThreadList } from "./thread-list";
import { emptyAssistantSettings, persistAssistantSettings, type AssistantSettings, ASSISTANT_SETTINGS_CHANGED } from "./settings";

export function AssistantModal({ configured, settings = emptyAssistantSettings }: { configured: boolean; settings?: AssistantSettings }) {
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
          <div className="assistant-header-right">
            <small>Local only</small>
            {configured && <ClearThreadButton />}
          </div>
        </header>
        {configured ? (
          <div className="assistant-modal-body">
            <AssistantThreadList />
            <AssistantThread />
          </div>
        ) : <AssistantSetup initial={settings} />}
      </AssistantModalPrimitive.Content>
    </AssistantModalPrimitive.Root>
  );
}

function ClearThreadButton() {
  const runtime = useAssistantRuntime();
  return (
    <button
      type="button"
      className="assistant-header-button"
      aria-label="Clear conversation"
      title="Clear conversation"
      onClick={() => {
        runtime.thread.cancelRun();
        runtime.thread.reset();
        void runtime.threads.mainItem.rename("New Thread").catch(() => undefined);
      }}
    >
      <Trash2 size={14} />
    </button>
  );
}

function AssistantSetup({ initial }: { initial: AssistantSettings }) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const save = () => {
    try {
      persistAssistantSettings(draft);
      setError("");
      window.dispatchEvent(new Event(ASSISTANT_SETTINGS_CHANGED));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  const update = (key: keyof AssistantSettings, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <div className="assistant-setup">
      <div className="assistant-setup-icon"><Bot size={20} /></div>
      <h3>Connect your local assistant</h3>
      <p>Enter your OpenAI-compatible provider here. These values stay in this browser and are never sent to Watcher’s tools.</p>
      <label>Base URL<input className="input" value={draft.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} placeholder="https://api.example.com/v1" /></label>
      <label>Provider API key<input className="input" type="password" value={draft.apiKey} onChange={(event) => update("apiKey", event.target.value)} placeholder="Provider key" /></label>
      <label>Model<input className="input" value={draft.model} onChange={(event) => update("model", event.target.value)} placeholder="model-name" /></label>
      <button type="button" className="button button-primary button-default assistant-setup-save" onClick={save}><Save size={14} />Save locally</button>
      {error && <p className="assistant-setup-error">{error}</p>}
    </div>
  );
}
