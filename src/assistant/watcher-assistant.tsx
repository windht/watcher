import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useEffect, useState } from "react";
import { AssistantModal } from "./assistant-modal";
import { useWatcherAssistantRuntime } from "./runtime";
import {
  ASSISTANT_SETTINGS_CHANGED,
  isAssistantConfigured,
  loadAssistantSettings,
  type AssistantSettings,
} from "./settings";

export function WatcherAssistant() {
  const [settings, setSettings] = useState(loadAssistantSettings);
  useEffect(() => {
    const reload = () => setSettings(loadAssistantSettings());
    window.addEventListener(ASSISTANT_SETTINGS_CHANGED, reload);
    return () => window.removeEventListener(ASSISTANT_SETTINGS_CHANGED, reload);
  }, []);
  if (!isAssistantConfigured(settings)) return null;
  return <ConfiguredAssistant key={settingsKey(settings)} settings={settings} />;
}

function ConfiguredAssistant({ settings }: { settings: AssistantSettings }) {
  const runtime = useWatcherAssistantRuntime(settings);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantModal />
    </AssistantRuntimeProvider>
  );
}

function settingsKey(settings: AssistantSettings) {
  return `${settings.baseUrl}\u0000${settings.model}\u0000${settings.apiKey}`;
}

