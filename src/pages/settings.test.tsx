import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings";

const mocks = vi.hoisted(() => ({
  checkForUpdate: vi.fn(),
  install: vi.fn(),
  refresh: vi.fn(),
  updateSettings: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
  snapshot: {
    workspaces: [],
    selectedWorkspaceId: "workspace-1",
    nodes: [],
    requests: [],
    environmentVariables: [],
    tabs: [],
    selectedTabId: null,
    settings: {
      selectedWorkspaceId: "workspace-1",
      theme: "dark",
      language: "en-US",
      checkForUpdates: true,
      expandedNodeIds: [],
      mcpServerPort: 11532,
    },
  },
}));

vi.mock("../lib/api", () => ({ api: { updateSettings: mocks.updateSettings } }));
vi.mock("../lib/updater", () => ({
  useUpdater: () => ({
    status: { state: "available", update: { version: "1.0.4" } },
    diagnostics: [],
    checkForUpdate: mocks.checkForUpdate,
    install: mocks.install,
  }),
}));
vi.mock("../lib/utils", () => ({
  cn: (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" "),
  isTauriRuntime: mocks.isTauriRuntime,
}));
vi.mock("../workspace-context", () => ({
  useWorkspace: () => ({ snapshot: mocks.snapshot, refresh: mocks.refresh }),
}));
vi.mock("../i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn() }));

describe("SettingsPage updater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts installation directly when the user clicks Install and relaunch", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "installRelaunch" }));

    expect(mocks.install).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });
});
