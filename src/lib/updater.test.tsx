import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdater } from "./updater";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  relaunch: vi.fn(),
  isTauriRuntime: vi.fn(() => true),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));
vi.mock("./utils", () => ({ isTauriRuntime: mocks.isTauriRuntime }));

describe("desktop updater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows download progress immediately, then installs and relaunches", async () => {
    let finishDownload!: () => void;
    const update = {
      version: "1.0.2",
      downloadAndInstall: vi.fn(
        () => new Promise<void>((resolve) => {
          finishDownload = resolve;
        }),
      ),
    };
    mocks.check.mockResolvedValue(update);
    mocks.relaunch.mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.checkForUpdate();
    });

    let installPromise!: Promise<void>;
    act(() => {
      installPromise = result.current.install();
    });
    expect(result.current.status).toMatchObject({
      state: "downloading",
      update,
      progress: 0,
    });

    finishDownload();
    await act(async () => {
      await installPromise;
    });
    expect(mocks.relaunch).toHaveBeenCalledOnce();
  });
});
