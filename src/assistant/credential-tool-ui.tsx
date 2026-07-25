import { useState } from "react";
import { api } from "../lib/api";
import { executeRequest } from "../lib/request";
import { createId } from "../lib/utils";
import type { HttpExecutionResult } from "../types";
import { isSensitiveHeader } from "./security";

type CredentialRequest = {
  requestId: string;
  headerName: string;
  message: string;
};

export function credentialRequestFromResult(result: unknown): CredentialRequest | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const candidate = (result as { credentialRequest?: unknown }).credentialRequest;
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Partial<CredentialRequest>;
  return typeof value.requestId === "string" &&
    typeof value.headerName === "string" &&
    typeof value.message === "string"
    ? value as CredentialRequest
    : null;
}

export function CredentialToolUi({ request }: { request: CredentialRequest }) {
  const [value, setValue] = useState("");
  const [bearer, setBearer] = useState(request.headerName.toLowerCase() === "authorization");
  const [sending, setSending] = useState(false);
  const [retry, setRetry] = useState<HttpExecutionResult | null>(null);
  const [error, setError] = useState("");

  const saveAndRetry = async () => {
    if (!value.trim()) return;
    setSending(true);
    setError("");
    try {
      const snapshot = await api.getSnapshot();
      const saved = snapshot.requests.find((item) => item.id === request.requestId);
      if (!saved) throw new Error("The saved request no longer exists.");
      const variableKey = `WATCHER_SECRET_${request.requestId}_${request.headerName}`
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .toUpperCase();
      const secretValue = bearer ? `Bearer ${value.trim()}` : value.trim();
      const existingVariable = snapshot.environmentVariables.find((item) => item.key === variableKey);
      const variables = [
        ...snapshot.environmentVariables.filter((item) => item.id !== existingVariable?.id),
        {
          id: existingVariable?.id ?? createId("env"),
          workspaceId: saved.workspaceId,
          active: true,
          key: variableKey,
          initialValue: "",
          currentValue: secretValue,
          position: existingVariable?.position ?? snapshot.environmentVariables.length,
        },
      ];
      const existingHeader = saved.headers.find(
        (item) => item.key.toLowerCase() === request.headerName.toLowerCase(),
      );
      const updated = {
        ...saved,
        headers: [
          ...saved.headers.filter((item) => item.id !== existingHeader?.id),
          {
            id: existingHeader?.id ?? createId("row"),
            active: true,
            key: request.headerName,
            value: `{{${variableKey}}}`,
            description: "Private value stored in Watcher environment",
          },
        ],
        updatedAt: Date.now(),
      };
      await api.saveEnvironments(saved.workspaceId, variables);
      await api.saveRequest(updated);
      const response = await executeRequest(updated, variables);
      await api.recordHistory(saved.workspaceId, updated, response);
      setValue("");
      setRetry(response);
      window.dispatchEvent(new Event("watcher:data-changed"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="assistant-credential">
      <strong>Private credential required</strong>
      <p>{request.message}</p>
      <label>
        <span>{request.headerName}</span>
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Stored locally — never sent to the model"
        />
      </label>
      {isSensitiveHeader(request.headerName) && request.headerName.toLowerCase() === "authorization" && (
        <label className="assistant-credential-check">
          <input type="checkbox" checked={bearer} onChange={(event) => setBearer(event.target.checked)} />
          Add “Bearer” prefix
        </label>
      )}
      <button type="button" disabled={sending || !value.trim()} onClick={() => void saveAndRetry()}>
        {sending ? "Saving and retrying…" : "Save privately & retry"}
      </button>
      {retry && (
        <p className={retry.status >= 200 && retry.status < 400 ? "assistant-retry-ok" : "assistant-retry-error"}>
          Retry: {retry.status || "Failed"} {retry.statusText}. Recorded in History.
        </p>
      )}
      {error && <p className="assistant-retry-error">{error}</p>}
    </div>
  );
}

