import { getVersion } from "@tauri-apps/api/app";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../lib/api";
import { isTauriRuntime } from "../lib/utils";
import { useUpdater } from "../lib/updater";
import type { Language, ThemeMode } from "../types";
import { useWorkspace } from "../workspace-context";
import { Badge, Button } from "../components/ui";
import { useI18n } from "../i18n";
import {
  ASSISTANT_SETTINGS_CHANGED,
  isAssistantConfigured,
  loadAssistantSettings,
  persistAssistantSettings,
  type AssistantSettings,
} from "../assistant/settings";

export function SettingsPage() {
  const { snapshot, refresh } = useWorkspace();
  const { t } = useI18n();
  const updater = useUpdater();
  const [version, setVersion] = useState("1.0.4");
  const [assistantSettings, setAssistantSettings] = useState<AssistantSettings>(loadAssistantSettings);
  const [assistantNotice, setAssistantNotice] = useState("");
  const availableUpdate =
    updater.status.state === "available" ? updater.status.update : null;

  useEffect(() => {
    if (isTauriRuntime()) void getVersion().then(setVersion);
  }, []);

  const updateSetting = async <K extends keyof typeof snapshot.settings>(
    key: K,
    value: (typeof snapshot.settings)[K],
  ) => {
    await api.updateSettings({ ...snapshot.settings, [key]: value });
    await refresh();
  };

  const updaterText = (() => {
    switch (updater.status.state) {
      case "checking": return t("updateChecking");
      case "available": return `Watcher ${updater.status.update.version} is available.`;
      case "current": return t("updateCurrent");
      case "downloading": return `Downloading… ${Math.round(updater.status.progress * 100)}%`;
      case "installing": return t("updateInstalling");
      case "error": return updater.status.message;
      default: return t("updateDefault");
    }
  })();

  const saveAssistantSettings = () => {
    try {
      const saved = persistAssistantSettings(assistantSettings);
      setAssistantSettings(saved);
      setAssistantNotice("Saved locally. The assistant launcher is ready.");
      window.dispatchEvent(new Event(ASSISTANT_SETTINGS_CHANGED));
    } catch (error) {
      setAssistantNotice(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div><h1>{t("settings")}</h1><p>{t("settingsDescription")}</p></div>
        <Badge>v{version}</Badge>
      </header>
      <div className="page-content">
        <section className="settings-section">
          <div className="settings-copy"><h2>{t("theme")}</h2><p>{t("themeDescription")}</p></div>
          <div className="settings-control">
            <label className="field-label" htmlFor="theme">{t("appearance")}</label>
            <select id="theme" className="select" value={snapshot.settings.theme} onChange={(event) => void updateSetting("theme", event.target.value as ThemeMode)}>
              <option value="dark">{t("dark")}</option><option value="light">{t("light")}</option><option value="system">{t("system")}</option>
            </select>
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-copy"><h2>{t("language")}</h2><p>{t("languageDescription")}</p></div>
          <div className="settings-control">
            <label className="field-label" htmlFor="language">{t("interfaceLanguage")}</label>
            <select id="language" className="select" value={snapshot.settings.language} onChange={(event) => void updateSetting("language", event.target.value as Language)}>
              <option value="en-US">English</option><option value="zh-CN">简体中文</option>
            </select>
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-copy"><h2>{t("updates")}</h2><p>{t("updatesDescription")}</p></div>
          <div className="settings-control">
            <label><input type="checkbox" checked={snapshot.settings.checkForUpdates} onChange={(event) => void updateSetting("checkForUpdates", event.target.checked)} /> {t("checkAfterStartup")}</label>
            <span className={updater.status.state === "error" ? "method-delete" : "muted"} aria-live="polite">{updaterText}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <Button disabled={updater.status.state === "checking" || updater.status.state === "downloading" || updater.status.state === "installing"} onClick={() => void updater.checkForUpdate()}><RefreshCw size={14} />{t("checkNow")}</Button>
              {availableUpdate && <Button variant="primary" onClick={() => void updater.install()}>{t("installRelaunch")}</Button>}
            </div>
            {updater.diagnostics.length > 0 && (
              <pre className="update-diagnostics" aria-label={t("updateActivity")} aria-live="polite">
                {updater.diagnostics.map((entry) => entry.message).join("\n")}
              </pre>
            )}
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-copy">
            <h2>API Assistant</h2>
            <p>Configure an OpenAI-compatible AI SDK v7 model. Provider credentials stay in this local webview.</p>
          </div>
          <div className="settings-control assistant-settings-control">
            <Badge tone={isAssistantConfigured(loadAssistantSettings()) ? "success" : undefined}>
              {isAssistantConfigured(loadAssistantSettings()) ? "Configured" : "Not configured"}
            </Badge>
            <label className="field-label" htmlFor="assistant-base-url">Base URL</label>
            <input
              id="assistant-base-url"
              className="input"
              value={assistantSettings.baseUrl}
              placeholder="https://api.openai.com/v1"
              onChange={(event) => setAssistantSettings({ ...assistantSettings, baseUrl: event.target.value })}
            />
            <label className="field-label" htmlFor="assistant-api-key">Provider API key</label>
            <input
              id="assistant-api-key"
              type="password"
              autoComplete="off"
              className="input"
              value={assistantSettings.apiKey}
              placeholder="Stored locally"
              onChange={(event) => setAssistantSettings({ ...assistantSettings, apiKey: event.target.value })}
            />
            <label className="field-label" htmlFor="assistant-model">Model</label>
            <input
              id="assistant-model"
              className="input"
              value={assistantSettings.model}
              placeholder="Your provider's model ID"
              onChange={(event) => setAssistantSettings({ ...assistantSettings, model: event.target.value })}
            />
            <Button variant="primary" onClick={saveAssistantSettings}>Save assistant settings</Button>
            {assistantNotice && <span className="muted">{assistantNotice}</span>}
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-copy"><h2>{t("localStorage")}</h2><p>{t("localStorageDescription")}</p></div>
          <div className="settings-control">
            <Badge tone="success">{t("localOnlyBadge")}</Badge>
            <Button variant="ghost" onClick={() => isTauriRuntime() ? void openUrl("https://github.com/windht/watcher") : window.open("https://github.com/windht/watcher", "_blank")}><ExternalLink size={14} />{t("githubRepository")}</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
