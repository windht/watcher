export type AssistantSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

const STORAGE_KEY = "watcher-assistant-settings-v1";

export const emptyAssistantSettings: AssistantSettings = {
  baseUrl: "",
  apiKey: "",
  model: "",
};

export function normalizeAssistantBaseUrl(value: string) {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "");
}

export function loadAssistantSettings(): AssistantSettings {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return emptyAssistantSettings;
    const value = JSON.parse(stored) as Partial<AssistantSettings>;
    return {
      baseUrl: typeof value.baseUrl === "string" ? normalizeAssistantBaseUrl(value.baseUrl) : "",
      apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
      model: typeof value.model === "string" ? value.model : "",
    };
  } catch {
    return emptyAssistantSettings;
  }
}

export function persistAssistantSettings(settings: AssistantSettings) {
  const normalized = {
    baseUrl: normalizeAssistantBaseUrl(settings.baseUrl),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
  };
  if (!normalized.baseUrl || !normalized.apiKey || !normalized.model) {
    throw new Error("Base URL, API key, and model are required.");
  }
  const parsed = new URL(normalized.baseUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Base URL must use HTTP or HTTPS.");
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function isAssistantConfigured(settings: AssistantSettings) {
  return Boolean(settings.baseUrl && settings.apiKey && settings.model);
}

export const ASSISTANT_SETTINGS_CHANGED = "watcher:assistant-settings-changed";
