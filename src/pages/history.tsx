import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, RotateCcw, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { formatBytes } from "../lib/utils";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, EmptyState } from "../components/ui";
import { useI18n } from "../i18n";

export function HistoryPage() {
  const { snapshot, openRequest } = useWorkspace();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ["history", snapshot.selectedWorkspaceId],
    queryFn: () => api.listHistory(snapshot.selectedWorkspaceId),
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t("history")}</h1>
          <p>{t("historyDescription")} {snapshot.workspaces.find((item) => item.id === snapshot.selectedWorkspaceId)?.name}.</p>
        </div>
        <Button
          variant="danger"
          disabled={!history.data?.length}
          onClick={async () => {
            if (!window.confirm(t("clearHistoryConfirm"))) return;
            await api.clearHistory(snapshot.selectedWorkspaceId);
            await queryClient.invalidateQueries({ queryKey: ["history", snapshot.selectedWorkspaceId] });
          }}
        >
          <Trash2 size={14} />{t("clearHistory")}
        </Button>
      </header>
      <div className="page-content">
        {!history.data?.length ? (
          <EmptyState icon={<Clock3 size={20} />} title={t("noHistory")} description={t("noHistoryDescription")} />
        ) : (
          <div className="history-list">
            {history.data.map((entry) => (
              <div className="history-row" key={entry.id}>
                <span className={`tree-method method-${entry.request.method.toLowerCase()}`}>{entry.request.method}</span>
                <span className="history-url">{entry.request.url}</span>
                <Badge tone={entry.response.status >= 400 || !entry.response.status ? "danger" : "success"}>{entry.response.status || "ERR"}</Badge>
                <span className="mono muted">{entry.response.durationMs} ms · {formatBytes(entry.response.sizeBytes)}</span>
                <span className="mono muted">{new Date(entry.createdAt).toLocaleString()}</span>
                <Button size="icon" variant="ghost" title={t("openRequest")} onClick={() => void openRequest(entry.request)}><RotateCcw size={14} /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
