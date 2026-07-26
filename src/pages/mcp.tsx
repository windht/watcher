import { Check, Clipboard, RefreshCw, Server } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button } from "../components/ui";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import type { McpServerStatus } from "../types";

const DEFAULT_STATUS: McpServerStatus = {
  running: false,
  port: 11532,
  endpoint: "http://127.0.0.1:11532/mcp",
};

export function McpPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<McpServerStatus>(DEFAULT_STATUS);
  const [port, setPort] = useState(String(DEFAULT_STATUS.port));
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getMcpServerStatus();
      setStatus(next);
      setPort((current) => current === String(status.port) ? String(next.port) : current);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [status.port]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const agentPrompt = useMemo(
    () => `Add Watcher as a Streamable HTTP MCP server named "watcher".

Server URL:
${status.endpoint}

After connecting, list Watcher's tools and use them for workspace, folder, and request CRUD. Use send_request or send_requests for HTTP execution so every run is recorded in Watcher History. Never put raw API keys or authorization values in MCP tool arguments; use Watcher environment placeholders instead.`,
    [status.endpoint],
  );

  const clientConfig = useMemo(
    () => JSON.stringify({ mcpServers: { watcher: { url: status.endpoint } } }, null, 2),
    [status.endpoint],
  );

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setNotice(`${label} copied.`);
  };

  const applyPort = async () => {
    const nextPort = Number(port);
    if (!Number.isInteger(nextPort) || nextPort < 1024 || nextPort > 65535) {
      setNotice("Choose a whole-number port between 1024 and 65535.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const next = await api.setMcpServerPort(nextPort);
      setStatus(next);
      setPort(String(next.port));
      setNotice(next.running ? `MCP server moved to port ${next.port}.` : "Port saved.");
      window.dispatchEvent(new Event("watcher:data-changed"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div><h1>{t("mcpServer")}</h1><p>{t("mcpDescription")}</p></div>
        <Badge tone={status.running ? "success" : "danger"}>
          {status.running ? "Running" : "Stopped"}
        </Badge>
      </header>
      <div className="page-content mcp-page">
        <section className="mcp-hero">
          <div className="mcp-hero-icon"><Server size={22} /></div>
          <div>
            <span className="mcp-eyebrow">STREAMABLE HTTP · LOCALHOST ONLY</span>
            <h2>Watcher agent bridge</h2>
            <p>Agents get the same request-management actions as the desktop UI, while executions remain visible in local History.</p>
          </div>
          <Button variant="ghost" size="compact" onClick={() => void refresh()}>
            <RefreshCw size={14} />Refresh
          </Button>
        </section>

        <div className="mcp-grid">
          <section className="mcp-card">
            <div className="mcp-card-heading">
              <div><h3>Server address</h3><p>Use this URL in clients that support Streamable HTTP MCP.</p></div>
              <span className={`mcp-status-dot ${status.running ? "running" : ""}`} />
            </div>
            <div className="mcp-copy-box">
              <code>{status.endpoint}</code>
              <button type="button" onClick={() => void copy(status.endpoint, "Address")} aria-label="Copy MCP address">
                <Clipboard size={15} />
              </button>
            </div>
            <label className="field-label" htmlFor="mcp-port">Local port</label>
            <div className="mcp-port-row">
              <input
                id="mcp-port"
                className="input"
                inputMode="numeric"
                value={port}
                onChange={(event) => setPort(event.target.value)}
              />
              <Button variant="primary" disabled={saving || port === String(status.port)} onClick={() => void applyPort()}>
                {saving ? "Applying…" : "Apply port"}
              </Button>
            </div>
            <p className="mcp-help">Changing the port rebinds the server immediately and persists across restarts.</p>
            {status.lastError && <div className="mcp-error">{status.lastError}</div>}
          </section>

          <section className="mcp-card">
            <div className="mcp-card-heading">
              <div><h3>Available capabilities</h3><p>17 tools backed by Watcher’s local workspace and History.</p></div>
            </div>
            <div className="mcp-capabilities">
              {[
                ["Workspaces", "List, read, create, rename, delete"],
                ["Folders", "List, read, create, move, rename, delete"],
                ["Requests", "List, read, create, update, delete"],
                ["Execution", "Send one request or an ordered list"],
              ].map(([name, description]) => (
                <div key={name}><Check size={14} /><span><strong>{name}</strong><small>{description}</small></span></div>
              ))}
            </div>
          </section>
        </div>

        <section className="mcp-card mcp-paste-card">
          <div className="mcp-card-heading">
            <div><h3>Paste into your agent</h3><p>This works as a setup request for agents that can add MCP servers.</p></div>
            <Button size="compact" onClick={() => void copy(agentPrompt, "Agent prompt")}>
              <Clipboard size={14} />Copy prompt
            </Button>
          </div>
          <pre>{agentPrompt}</pre>
        </section>

        <section className="mcp-card mcp-paste-card">
          <div className="mcp-card-heading">
            <div><h3>Client configuration</h3><p>Generic JSON shape for clients that accept an MCP server configuration.</p></div>
            <Button size="compact" onClick={() => void copy(clientConfig, "Configuration")}>
              <Clipboard size={14} />Copy JSON
            </Button>
          </div>
          <pre>{clientConfig}</pre>
        </section>
        {notice && <div className="mcp-notice" role="status">{notice}</div>}
      </div>
    </div>
  );
}
