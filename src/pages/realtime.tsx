import { json } from "@codemirror/lang-json";
import CodeMirror from "@uiw/react-codemirror";
import {
  CircleStop,
  FilePlus2,
  PlugZap,
  Radio,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  clearRealtimeEvents,
  disconnectRealtime,
  getRealtimeResponse,
  sendRealtimeMessage,
  startRealtimeRequest,
  subscribeRealtimeResponse,
} from "../lib/realtime";
import { createId, formatBytes } from "../lib/utils";
import { defaultRealtimeConfig, type ApiRequest, type KeyValueRow, type RealtimeResponse } from "../types";
import { useWorkspace } from "../workspace-context";
import { Button, EmptyState } from "../components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/select";
import { useI18n } from "../i18n";

type RealtimeTransport = "sse" | "websocket";

const transportLabels: Record<RealtimeTransport, string> = {
  sse: "SSE",
  websocket: "WebSocket",
};

const sseMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function newHeader(): KeyValueRow {
  return {
    id: createId("row"),
    active: true,
    key: "",
    value: "",
    description: "",
  };
}

function connectionTone(state?: RealtimeResponse["state"]) {
  if (state === "connected") return "success";
  if (state === "error") return "danger";
  if (state === "connecting") return "warning";
  return "neutral";
}

function connectionLabel(response: RealtimeResponse | undefined, disconnected: string) {
  if (!response) return disconnected;
  if (response.status) return `${response.status} ${response.statusText ?? ""}`.trim();
  return response.state;
}

function RealtimeWorkspace({ request }: { request: ApiRequest }) {
  const { snapshot, refresh } = useWorkspace();
  const { t, language } = useI18n();
  const [draft, setDraft] = useState(() => structuredClone(request));
  const [response, setResponse] = useState<RealtimeResponse | undefined>(() => getRealtimeResponse(request.id));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const editorTheme = snapshot.settings.theme === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    : snapshot.settings.theme;

  useEffect(() => {
    return subscribeRealtimeResponse(request.id, setResponse);
  }, [request.id]);

  const save = async () => {
    setError("");
    if (!draft.name.trim()) {
      setError(language === "zh-CN" ? "请输入连接名称。" : "Enter a connection name.");
      return;
    }
    if (!draft.url.trim()) {
      setError(language === "zh-CN" ? "请输入连接地址。" : "Enter a connection URL.");
      return;
    }
    const saved = { ...draft, name: draft.name.trim(), url: draft.url.trim(), updatedAt: Date.now() };
    await api.saveRequest(saved);
    setDraft(saved);
    setNotice(t("saved"));
    window.setTimeout(() => setNotice(""), 1_200);
    await refresh();
  };

  const start = () => {
    setError("");
    try {
      setResponse(startRealtimeRequest(draft, snapshot.environmentVariables));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const stop = () => setResponse(disconnectRealtime(request.id));

  const send = () => {
    setError("");
    try {
      setResponse(sendRealtimeMessage(draft, snapshot.environmentVariables));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const updateHeader = (index: number, changes: Partial<KeyValueRow>) => {
    setDraft((current) => ({
      ...current,
      headers: current.headers.map((header, headerIndex) =>
        headerIndex === index ? { ...header, ...changes } : header,
      ),
    }));
  };

  const updateFormData = (index: number, changes: Partial<KeyValueRow>) => {
    setDraft((current) => ({
      ...current,
      body: {
        ...current.body,
        formData: current.body.formData.map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...changes } : row,
        ),
      },
    }));
  };

  const isOpen = response?.state === "connected" || response?.state === "connecting";
  const isWebSocket = draft.transport === "websocket";

  return (
    <div className="realtime-workspace">
      <section className="realtime-command">
        <div className="realtime-command-main">
          <label className="realtime-label" htmlFor="realtime-name">{t("connectionName")}</label>
          <input
            id="realtime-name"
            className="input realtime-name"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </div>
        <div className="realtime-command-main realtime-url-control">
          <label className="realtime-label" htmlFor="realtime-url">{t("endpoint")}</label>
          <div className="realtime-url-row">
            {!isWebSocket && (
              <select
                className="realtime-inline-select mono"
                value={draft.method}
                onChange={(event) => setDraft((current) => ({ ...current, method: event.target.value }))}
                aria-label={t("method")}
              >
                {sseMethods.map((method) => <option key={method} value={method}>{method}</option>)}
              </select>
            )}
            <input
              id="realtime-url"
              className="input mono"
              spellCheck={false}
              placeholder={isWebSocket ? "wss://example.com/socket" : "https://example.com/events"}
              value={draft.url}
              onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
            />
          </div>
        </div>
        <Button size="compact" variant="secondary" onClick={() => void save()}><Save size={14} />{t("save")}</Button>
        {isOpen ? (
          <Button size="compact" variant="danger" onClick={stop}><CircleStop size={14} />{t("disconnect")}</Button>
        ) : (
          <Button size="compact" variant="primary" onClick={start}>{isWebSocket ? <PlugZap size={14} /> : <Radio size={14} />}{isWebSocket ? t("connect") : t("start")}</Button>
        )}
      </section>

      <section className="realtime-config">
        <div className="realtime-config-heading">
          <div>
            <span>{isWebSocket ? t("websocketSettings") : t("sseSettings")}</span>
            <small>{isWebSocket ? t("websocketHint") : t("sseHint")}</small>
          </div>
          <span className={`realtime-state ${connectionTone(response?.state)}`}>{connectionLabel(response, t("disconnected"))}</span>
        </div>

        {isWebSocket ? (
          <label className="realtime-field">
            <span>{t("protocols")}</span>
            <input
              className="input mono"
              placeholder="graphql-transport-ws, chat"
              value={draft.realtime.protocols.join(", ")}
              onChange={(event) => setDraft((current) => ({
                ...current,
                realtime: {
                  ...current.realtime,
                  protocols: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                },
              }))}
            />
            <small>{t("protocolsHint")}</small>
          </label>
        ) : (
          <div className="realtime-headers">
            <div className="realtime-field-heading"><span>{t("headers")}</span><small>{t("sseHeadersHint")}</small></div>
            <div className="realtime-headers-table">
              {draft.headers.map((header, index) => (
                <div className="realtime-header-row" key={header.id}>
                  <input type="checkbox" checked={header.active} onChange={(event) => updateHeader(index, { active: event.target.checked })} aria-label={t("use")} />
                  <input className="input mono" value={header.key} onChange={(event) => updateHeader(index, { key: event.target.value })} placeholder="Header" />
                  <input className="input mono" value={header.value} onChange={(event) => updateHeader(index, { value: event.target.value })} placeholder="Value" />
                  <Button size="icon" variant="ghost" title={t("removeHeader")} onClick={() => setDraft((current) => ({ ...current, headers: current.headers.filter((_, headerIndex) => headerIndex !== index) }))}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
            <Button size="compact" variant="ghost" onClick={() => setDraft((current) => ({ ...current, headers: [...current.headers, newHeader()] }))}><FilePlus2 size={13} />{t("addHeader")}</Button>
          </div>
        )}

        {!isWebSocket && (
          <div className="realtime-sse-body">
            <div className="realtime-field-heading">
              <span>{t("body")}</span>
              <select
                className="realtime-inline-select"
                value={draft.body.mode}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  body: { ...current.body, mode: event.target.value as ApiRequest["body"]["mode"] },
                }))}
                aria-label={t("body")}
              >
                <option value="none">{language === "zh-CN" ? "无请求体" : "No body"}</option>
                <option value="json">JSON</option>
                <option value="text">{language === "zh-CN" ? "文本" : "Text"}</option>
                <option value="form-data">{language === "zh-CN" ? "表单数据" : "Form data"}</option>
              </select>
            </div>
            {draft.body.mode === "none" && <p className="realtime-empty-body">{language === "zh-CN" ? "此 SSE 连接使用不带请求体的请求。" : "This SSE connection sends no request body."}</p>}
            {(draft.body.mode === "json" || draft.body.mode === "text") && (
              <CodeMirror
                className="realtime-message-editor"
                height="146px"
                theme={editorTheme}
                value={draft.body.raw}
                onChange={(raw) => setDraft((current) => ({ ...current, body: { ...current.body, raw } }))}
                extensions={draft.body.mode === "json" ? [json()] : []}
                placeholder={draft.body.mode === "json" ? '{ "stream": true }' : t("messagePlaceholder")}
              />
            )}
            {draft.body.mode === "form-data" && (
              <div className="realtime-headers-table">
                {draft.body.formData.map((row, index) => (
                  <div className="realtime-header-row" key={row.id}>
                    <input type="checkbox" checked={row.active} onChange={(event) => updateFormData(index, { active: event.target.checked })} aria-label={t("use")} />
                    <input className="input mono" value={row.key} onChange={(event) => updateFormData(index, { key: event.target.value })} placeholder="Key" />
                    <input className="input mono" value={row.value} onChange={(event) => updateFormData(index, { value: event.target.value })} placeholder="Value" />
                    <Button size="icon" variant="ghost" title={t("removeHeader")} onClick={() => setDraft((current) => ({ ...current, body: { ...current.body, formData: current.body.formData.filter((_, rowIndex) => rowIndex !== index) } }))}><Trash2 size={14} /></Button>
                  </div>
                ))}
                <Button size="compact" variant="ghost" onClick={() => setDraft((current) => ({ ...current, body: { ...current.body, formData: [...current.body.formData, newHeader()] } }))}><FilePlus2 size={13} />{language === "zh-CN" ? "添加字段" : "Add field"}</Button>
              </div>
            )}
          </div>
        )}

        {isWebSocket && (
          <div className="realtime-message">
            <div className="realtime-field-heading">
              <span>{t("message")}</span>
              <Select
                value={draft.realtime.messageFormat}
                onValueChange={(messageFormat: "text" | "json") => setDraft((current) => ({ ...current, realtime: { ...current.realtime, messageFormat } }))}
              >
                <SelectTrigger className="realtime-message-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CodeMirror
              className="realtime-message-editor"
              height="146px"
              theme={editorTheme}
              value={draft.realtime.message}
              onChange={(message) => setDraft((current) => ({ ...current, realtime: { ...current.realtime, message } }))}
              extensions={draft.realtime.messageFormat === "json" ? [json()] : []}
              placeholder={draft.realtime.messageFormat === "json" ? '{ "type": "ping" }' : t("messagePlaceholder")}
            />
            <div className="realtime-message-action">
              <small>{t("messageHint")}</small>
              <Button size="compact" variant="secondary" disabled={response?.state !== "connected" || !draft.realtime.message.trim()} onClick={send}><Send size={14} />{t("send")}</Button>
            </div>
          </div>
        )}
      </section>

      <section className="realtime-log" aria-live="polite">
        <div className="realtime-log-toolbar">
          <div>
            <strong>{t("eventLog")}</strong>
            <span>{response?.events.length ?? 0} {t("events")} · {formatBytes(response?.sizeBytes ?? 0)}</span>
          </div>
          <Button size="compact" variant="ghost" disabled={!response?.events.length} onClick={() => setResponse(clearRealtimeEvents(request.id))}><Trash2 size={13} />{t("clearLog")}</Button>
        </div>
        <div className="realtime-log-body">
          {error && <div className="response-error">{error}</div>}
          {response?.error && <div className="response-error">{response.error}</div>}
          {!response?.events.length ? (
            <EmptyState icon={isWebSocket ? <PlugZap size={19} /> : <Radio size={19} />} title={t("noRealtimeEvents")} description={isWebSocket ? t("noWebSocketEventsDescription") : t("noSseEventsDescription")} />
          ) : (
            <div className="realtime-events">
              {response.events.map((event) => (
                <article className={`realtime-event ${event.direction}`} key={event.sequence}>
                  <div className="realtime-event-meta">
                    <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                    <span>{event.direction}</span>
                    <strong>{event.event}</strong>
                    {event.eventId && <span>#{event.eventId}</span>}
                  </div>
                  <pre>{event.data || "—"}</pre>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      {notice && <div className="realtime-notice" role="status">{notice}</div>}
    </div>
  );
}

export function RealtimePage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { snapshot, refresh } = useWorkspace();
  const { t } = useI18n();
  const [pendingTransport, setPendingTransport] = useState<RealtimeTransport>("sse");
  const realtimeRequests = useMemo(
    () => snapshot.requests.filter((request) => request.transport === "sse" || request.transport === "websocket"),
    [snapshot.requests],
  );
  const selected = realtimeRequests.find((request) => request.id === requestId);
  const transport: RealtimeTransport = selected?.transport === "sse" || selected?.transport === "websocket"
    ? selected.transport
    : pendingTransport;

  const selectTransport = (next: RealtimeTransport) => {
    setPendingTransport(next);
    const first = realtimeRequests.find((request) => request.transport === next);
    navigate(first ? `/realtime/${first.id}` : "/realtime");
  };

  const createConnection = async (next: RealtimeTransport = transport) => {
    const created = await api.createRequest(snapshot.selectedWorkspaceId, null);
    const request: ApiRequest = {
      ...created.request,
      name: next === "sse" ? "New SSE stream" : "New WebSocket",
      transport: next,
      method: "GET",
      realtime: defaultRealtimeConfig(),
      updatedAt: Date.now(),
    };
    await api.saveRequest(request);
    await refresh();
    setPendingTransport(next);
    navigate(`/realtime/${request.id}`);
  };

  return (
    <div className="page realtime-page">
      <header className="page-header">
        <div>
          <h1>{t("realtime")}</h1>
          <p>{t("realtimeDescription")}</p>
        </div>
        <Button variant="primary" onClick={() => void createConnection()}><FilePlus2 size={15} />{transport === "sse" ? t("newSse") : t("newWebSocket")}</Button>
      </header>
      <div className="realtime-page-content">
        <div className="realtime-tabs" role="tablist" aria-label={t("realtime")}>
          {(["sse", "websocket"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={transport === item}
              className={transport === item ? "active" : ""}
              onClick={() => selectTransport(item)}
            >
              {item === "sse" ? <Radio size={16} /> : <PlugZap size={16} />}
              {transportLabels[item]}
            </button>
          ))}
          <div className="realtime-saved-select">
            <Select
              value={selected?.id ?? ""}
              onValueChange={(value) => navigate(`/realtime/${value}`)}
            >
              <SelectTrigger aria-label={t("savedConnections")} data-placeholder={!selected || undefined}><SelectValue placeholder={t("savedConnections")} /></SelectTrigger>
              <SelectContent>
                {realtimeRequests.filter((request) => request.transport === transport).map((request) => (
                  <SelectItem key={request.id} value={request.id}>{request.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {selected ? (
          <RealtimeWorkspace key={selected.id} request={selected} />
        ) : (
          <EmptyState
            icon={transport === "sse" ? <Radio size={20} /> : <PlugZap size={20} />}
            title={transport === "sse" ? t("noSseConnections") : t("noWebSocketConnections")}
            description={transport === "sse" ? t("noSseConnectionsDescription") : t("noWebSocketConnectionsDescription")}
            action={<Button variant="primary" onClick={() => void createConnection()}><FilePlus2 size={15} />{transport === "sse" ? t("newSse") : t("newWebSocket")}</Button>}
          />
        )}
      </div>
    </div>
  );
}
