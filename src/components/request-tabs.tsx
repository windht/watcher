import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useUiStore } from "../store/ui";
import { useWorkspace } from "../workspace-context";
import { Button } from "./ui";

export function RequestTabs() {
  const { snapshot, closeTab } = useWorkspace();
  const collapsed = useUiStore((state) => state.collectionCollapsed);
  const toggleCollection = useUiStore((state) => state.toggleCollection);

  return (
    <div className="request-tabs">
      {snapshot.tabs.map((tab) => (
        <NavLink key={tab.id} to={`/requests/${tab.requestId}`} className="request-tab">
          <span className={`tree-method method-${tab.draft.method.toLowerCase()}`}>{tab.draft.method.slice(0, 6)}</span>
          <span className="request-tab-label">{tab.draft.name}</span>
          {tab.dirty && <span className="dirty-dot" title="Unsaved changes" />}
          <button
            className="tab-close"
            aria-label={`Close ${tab.draft.name}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void closeTab(tab.id);
            }}
          >
            <X size={12} />
          </button>
        </NavLink>
      ))}
      <Button className="collapse-control" size="icon" variant="ghost" onClick={toggleCollection} title={collapsed ? "Show collections" : "Hide collections"}>
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </Button>
    </div>
  );
}
