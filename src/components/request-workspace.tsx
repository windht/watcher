import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import CodeMirror from "@uiw/react-codemirror";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Code2,
  Clipboard,
  FileBraces,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
} from "react-hook-form";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { z } from "zod";
import { api } from "../lib/api";
import { executeRequest, environmentMap } from "../lib/request";
import { runScript } from "../lib/scripts";
import { generateSnippet, SNIPPET_LANGUAGES, type SnippetLanguageId } from "../lib/snippets";
import { createId, formatBytes, prettyBody } from "../lib/utils";
import { useUiStore } from "../store/ui";
import type {
  ApiRequest,
  EnvironmentVariable,
  HttpExecutionResult,
  KeyValueRow,
} from "../types";
import { useWorkspace } from "../workspace-context";
import { Button, EmptyState } from "./ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { useI18n } from "../i18n";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const BODY_MODES = ["none", "json", "text", "form-data"] as const;

const rowSchema = z.object({
  id: z.string(),
  active: z.boolean(),
  key: z.string(),
  value: z.string(),
  description: z.string(),
});
const requestSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(1, "A request name is required."),
  transport: z.enum(["http", "sse", "websocket"]),
  method: z.string().min(1),
  url: z.string().min(1, "Enter a request URL."),
  params: z.array(rowSchema),
  headers: z.array(rowSchema),
  body: z.object({
    mode: z.enum(["none", "json", "text", "form-data"]),
    raw: z.string(),
    formData: z.array(rowSchema),
  }),
  realtime: z.object({
    protocols: z.array(z.string()),
    message: z.string(),
    messageFormat: z.enum(["text", "json"]),
  }),
  preRequestScript: z.string(),
  postResponseScript: z.string(),
  updatedAt: z.number(),
});

type RequestSection = "params" | "headers" | "body" | "pre" | "post";

function newRow(): KeyValueRow {
  return {
    id: createId("row"),
    active: true,
    key: "",
    value: "",
    description: "",
  };
}

function KeyValueEditor({
  control,
  name,
}: {
  control: Control<ApiRequest>;
  name: "params" | "headers" | "body.formData";
}) {
  const { language } = useI18n();
  const labels = language === "zh-CN"
    ? { key: "键", value: "值", description: "说明", enable: "启用此行", remove: "删除此行", add: "添加一行" }
    : { key: "Key", value: "Value", description: "Description", enable: "Enable row", remove: "Remove row", add: "Add row" };
  const { fields, append, remove } = useFieldArray({ control, name: name as any });
  return (
    <div className="section-content">
      <table className="kv-table">
        <thead>
          <tr><th className="kv-check" /><th>{labels.key}</th><th>{labels.value}</th><th>{labels.description}</th><th className="kv-remove" /></tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={field.id}>
              <td className="kv-check">
                <Controller
                  control={control}
                  name={`${name}.${index}.active` as any}
                  render={({ field: input }) => <input type="checkbox" checked={input.value} onChange={input.onChange} aria-label={labels.enable} />}
                />
              </td>
              {(["key", "value", "description"] as const).map((key) => (
                <td key={key}>
                  <Controller
                    control={control}
                    name={`${name}.${index}.${key}` as any}
                    render={({ field: input }) => <input {...input} value={String(input.value ?? "")} className="kv-input" placeholder={key === "key" ? labels.key : ""} />}
                  />
                </td>
              ))}
              <td className="kv-remove">
                <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)} aria-label={labels.remove}><Trash2 size={13} /></Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button type="button" size="compact" variant="ghost" className="add-row" onClick={() => append(newRow() as any)}><Plus size={13} />{labels.add}</Button>
    </div>
  );
}

function ResponsePanel({
  request,
  response,
  editorTheme,
}: {
  request: ApiRequest;
  response?: HttpExecutionResult;
  editorTheme: "light" | "dark";
}) {
  const { t, language } = useI18n();
  const [tab, setTab] = useState<"body" | "headers" | "snippet">("body");
  const [snippetLanguage, setSnippetLanguage] = useState<SnippetLanguageId>("curl");
  const [copied, setCopied] = useState(false);
  const selectedSnippetLanguage = SNIPPET_LANGUAGES.find((item) => item.id === snippetLanguage) ?? SNIPPET_LANGUAGES[0];
  const snippet = useMemo(() => generateSnippet(request, snippetLanguage), [request, snippetLanguage]);
  const responseContent = response
    ? tab === "body"
      ? prettyBody(response.body)
      : Object.entries(response.headers).map(([key, value]) => `${key}: ${value}`).join("\n")
    : "";
  const content = tab === "snippet" ? snippet : responseContent;
  const isSnippet = tab === "snippet";
  return (
    <div className="response-panel">
      <div className="response-toolbar">
        <button type="button" className={`section-tab ${tab === "body" ? "active" : ""}`} onClick={() => setTab("body")}>{t("body")}</button>
        <button type="button" className={`section-tab ${tab === "headers" ? "active" : ""}`} onClick={() => setTab("headers")}>{t("headers")}</button>
        <button type="button" className={`section-tab snippet-tab ${isSnippet ? "active" : ""}`} onClick={() => setTab("snippet")}>
          <Code2 size={13} aria-hidden />
          {t("codeSnippet")}
        </button>
        {isSnippet ? (
          <Select value={snippetLanguage} onValueChange={(value) => setSnippetLanguage(value as SnippetLanguageId)}>
            <SelectTrigger className="snippet-language-select" aria-label={t("snippetLanguage")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SNIPPET_LANGUAGES.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : response ? (
          <div className="response-meta">
            <span className={response.status >= 400 || response.status === 0 ? "method-delete" : "method-get"}>
              {response.status || "ERR"} {response.statusText}
            </span>
            <span>{response.durationMs} ms</span>
            <span>{formatBytes(response.sizeBytes)}</span>
          </div>
        ) : null}
      </div>
      {!response && !isSnippet ? (
        <EmptyState icon={<FileBraces size={19} />} title={t("noResponse")} description={t("noResponseDescription")} />
      ) : (
        <div className={`response-body ${isSnippet ? "snippet-response-body" : ""}`}>
          {isSnippet && (
            <div className="snippet-heading">
              <span>{t("generatedCode")}</span>
              <span>{selectedSnippetLanguage.syntax}</span>
            </div>
          )}
          {!isSnippet && response?.error && <div className="response-error">{response.error}</div>}
          <Button
            size="icon"
            variant="secondary"
            className="response-copy"
            title={isSnippet ? t("copyCode") : language === "zh-CN" ? "复制响应" : "Copy response"}
            aria-label={isSnippet ? t("copyCode") : language === "zh-CN" ? "复制响应" : "Copy response"}
            onClick={async () => {
              await navigator.clipboard.writeText(content);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1_200);
            }}
          >
            {copied ? <Check size={14} /> : <Clipboard size={14} />}
          </Button>
          <CodeMirror
            className="code-editor"
            value={content}
            height="100%"
            theme={editorTheme}
            readOnly
            basicSetup={{ lineNumbers: true, foldGutter: true }}
            extensions={tab === "body" ? [json()] : isSnippet && selectedSnippetLanguage.syntax === "javascript" ? [javascript()] : []}
          />
        </div>
      )}
    </div>
  );
}

export function RequestWorkspace({ request }: { request: ApiRequest }) {
  const { t, language } = useI18n();
  const { snapshot, refresh, setTabs } = useWorkspace();
  const tab = snapshot.tabs.find((item) => item.requestId === request.id);
  const responses = useUiStore((state) => state.responses);
  const setResponse = useUiStore((state) => state.setResponse);
  const [section, setSection] = useState<RequestSection>("params");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const persistTimer = useRef<number | null>(null);
  const editorTheme =
    snapshot.settings.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : snapshot.settings.theme;
  const initial = tab?.draft ?? request;
  const form = useForm<ApiRequest>({
    resolver: zodResolver(requestSchema),
    defaultValues: structuredClone(initial),
    mode: "onChange",
  });
  const { control, register, handleSubmit, watch, reset, formState } = form;
  const currentRequest = watch();

  useEffect(() => {
    const subscription = watch((value) => {
      if (!tab) return;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(() => {
        const draft = value as ApiRequest;
        const tabs = snapshot.tabs.map((item) =>
          item.id === tab.id ? { ...item, draft, dirty: true } : item,
        );
        void setTabs(tabs, tab.id);
      }, 250);
    });
    return () => {
      subscription.unsubscribe();
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [setTabs, snapshot.tabs, tab, watch]);

  const save = handleSubmit(async (values) => {
    const saved = { ...values, updatedAt: Date.now() };
    await api.saveRequest(saved);
    const tabs = snapshot.tabs.map((item) =>
      item.requestId === saved.id ? { ...item, draft: saved, dirty: false } : item,
    );
    await setTabs(tabs, tab?.id ?? null);
    reset(saved);
    setNotice("Saved");
    window.setTimeout(() => setNotice(""), 1_200);
    await refresh();
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void sendRequest(form.getValues());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const mergeEnvironment = async (values: Record<string, string>) => {
    const current = new Map(snapshot.environmentVariables.map((item) => [item.key, item]));
    const variables: EnvironmentVariable[] = Object.entries(values).map(([key, value], position) => {
      const existing = current.get(key);
      return existing
        ? { ...existing, currentValue: value, position }
        : {
            id: createId("environment"),
            workspaceId: snapshot.selectedWorkspaceId,
            active: true,
            key,
            initialValue: "",
            currentValue: value,
            position,
          };
    });
    await api.saveEnvironments(snapshot.selectedWorkspaceId, variables);
    return variables;
  };

  const sendRequest = async (values: ApiRequest) => {
    const parsed = requestSchema.safeParse(values);
    if (!parsed.success) {
      setNotice(parsed.error.issues[0]?.message ?? "Check the request fields.");
      return;
    }
    setSending(true);
    setNotice("");
    try {
      let workingRequest = structuredClone(parsed.data);
      let variables = snapshot.environmentVariables;
      if (workingRequest.preRequestScript.trim()) {
        const scriptResult = await runScript(workingRequest.preRequestScript, {
          request: workingRequest,
          environment: environmentMap(variables),
        });
        workingRequest = scriptResult.request;
        variables = await mergeEnvironment(scriptResult.environment);
      }
      let response = await executeRequest(workingRequest, variables);
      if (workingRequest.postResponseScript.trim()) {
        const scriptResult = await runScript(workingRequest.postResponseScript, {
          request: workingRequest,
          response,
          environment: environmentMap(variables),
        });
        response = scriptResult.response ?? response;
        await mergeEnvironment(scriptResult.environment);
      }
      setResponse(request.id, response);
      await api.recordHistory(snapshot.selectedWorkspaceId, workingRequest, response);
    } catch (error) {
      const response: HttpExecutionResult = {
        status: 0,
        statusText: "Script failed",
        headers: {},
        body: "",
        durationMs: 0,
        sizeBytes: 0,
        error: error instanceof Error ? error.message : String(error),
      };
      setResponse(request.id, response);
    } finally {
      setSending(false);
    }
  };

  const sections: Array<[RequestSection, string]> = [
    ["params", t("params")],
    ["headers", t("headers")],
    ["body", t("body")],
    ["pre", t("preRequest")],
    ["post", t("postResponse")],
  ];
  const bodyModeOptions = BODY_MODES.map((value) => ({
    value,
    label:
      value === "none"
        ? language === "zh-CN"
          ? "无"
          : "None"
        : value === "json"
          ? "JSON"
          : value === "text"
            ? language === "zh-CN"
              ? "文本"
              : "Text"
            : language === "zh-CN"
              ? "表单数据"
              : "Form data",
  }));

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "request-response-split",
    panelIds: ["request", "response"],
  });

  return (
    <form className="request-editor" onSubmit={save}>
      <div className="request-title-row">
        <input className="request-title-input" aria-label="Request name" {...register("name")} />
      </div>
      <div className="request-command">
        <Controller
          control={control}
          name="method"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="method-select" aria-label="HTTP method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="method-select-content">
                {HTTP_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <input className="input url-input" placeholder="https://api.example.com/v1/resource" {...register("url")} />
        <Button className="save-button" type="submit" disabled={!formState.isDirty && !tab?.dirty}><Save size={15} />{notice || t("save")}</Button>
        <Button type="button" variant="primary" disabled={sending} onClick={() => void sendRequest(form.getValues())}>
          <Send size={15} />{sending ? t("sending") : t("send")}
        </Button>
      </div>
      <Group
        id="request-response-split"
        orientation="vertical"
        className="request-split"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel id="request" className="request-panel" minSize="18%" defaultSize="58%">
          <section className="request-section">
            <div className="section-tabs" role="tablist">
              {sections.map(([key, label]) => (
                <button key={key} type="button" className={`section-tab ${section === key ? "active" : ""}`} onClick={() => setSection(key)}>{label}</button>
              ))}
            </div>
            {section === "params" && <KeyValueEditor control={control} name="params" />}
            {section === "headers" && <KeyValueEditor control={control} name="headers" />}
            {section === "body" && (
              <div className="section-content" style={{ display: "grid", gridTemplateRows: "44px minmax(0,1fr)" }}>
                <div className="body-mode">
                  <label className="field-label" htmlFor="body-mode">{language === "zh-CN" ? "请求体类型" : "Body type"}</label>
                  <Controller
                    control={control}
                    name="body.mode"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="body-mode" className="body-mode-select" aria-label={language === "zh-CN" ? "请求体类型" : "Body type"}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {bodyModeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                {watch("body.mode") === "form-data" ? (
                  <KeyValueEditor control={control} name="body.formData" />
                ) : watch("body.mode") === "none" ? (
                  <EmptyState icon={<FileBraces size={18} />} title="No request body" description="Choose JSON, text, or form data when this endpoint accepts a payload." />
                ) : (
                  <Controller
                    control={control}
                    name="body.raw"
                    render={({ field }) => (
                      <CodeMirror className="code-editor" height="100%" theme={editorTheme} value={field.value} onChange={field.onChange} extensions={watch("body.mode") === "json" ? [json()] : []} />
                    )}
                  />
                )}
              </div>
            )}
            {(section === "pre" || section === "post") && (
              <Controller
                control={control}
                name={section === "pre" ? "preRequestScript" : "postResponseScript"}
                render={({ field }) => (
                  <CodeMirror
                    className="code-editor"
                    height="100%"
                    theme={editorTheme}
                    value={field.value}
                    onChange={field.onChange}
                    extensions={[javascript()]}
                    placeholder={section === "pre" ? 'watcher.environment.set("token", "value");' : 'watcher.log(response.status);'}
                  />
                )}
              />
            )}
          </section>
        </Panel>
        <Separator
          className="response-resize-handle"
          style={{ height: 6 }}
          aria-label={language === "zh-CN" ? "拖动以调整响应面板高度" : "Drag to resize response panel"}
          title={language === "zh-CN" ? "拖动以调整响应面板高度" : "Drag to resize response panel"}
        >
          <span className="response-resize-grip" aria-hidden />
        </Separator>
        <Panel id="response" className="response-panel-host" minSize="18%" defaultSize="42%">
          <ResponsePanel request={currentRequest} response={responses[request.id]} editorTheme={editorTheme} />
        </Panel>
      </Group>
    </form>
  );
}
