import { FileBraces, Plus } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { CollectionTree } from "../components/collection-tree";
import { RequestTabs } from "../components/request-tabs";
import { RequestWorkspace } from "../components/request-workspace";
import { Button, EmptyState } from "../components/ui";
import { useUiStore } from "../store/ui";
import { useWorkspace } from "../workspace-context";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

export function RequestsPage() {
  const { requestId } = useParams();
  const { t } = useI18n();
  const { snapshot, openRequest } = useWorkspace();
  const collapsed = useUiStore((state) => state.collectionCollapsed);
  const request = snapshot.requests.find((item) => item.id === requestId);

  useEffect(() => {
    if (!requestId && snapshot.selectedTabId) {
      const tab = snapshot.tabs.find((item) => item.id === snapshot.selectedTabId);
      const selected = snapshot.requests.find((item) => item.id === tab?.requestId);
      if (selected) void openRequest(selected);
    }
  }, [openRequest, requestId, snapshot.requests, snapshot.selectedTabId, snapshot.tabs]);

  const createRootRequest = async () => {
    const result = await api.createRequest(snapshot.selectedWorkspaceId, null);
    await openRequest(result.request);
  };

  return (
    <div className={`request-layout ${collapsed ? "collection-collapsed" : ""}`}>
      <CollectionTree />
      <div className="workspace-area">
        <RequestTabs />
        {request ? (
          <RequestWorkspace key={request.id} request={request} />
        ) : (
          <EmptyState
            icon={<FileBraces size={20} />}
            title={t("buildRequest")}
            description={t("buildRequestDescription")}
            action={<Button variant="primary" onClick={() => void createRootRequest()}><Plus size={15} />{t("newRequest")}</Button>}
          />
        )}
      </div>
    </div>
  );
}
