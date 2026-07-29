import type { PropsWithChildren } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssistantModal } from "./assistant-modal";

vi.mock("@assistant-ui/react", () => ({
  AssistantModalPrimitive: {
    Root: ({ children }: PropsWithChildren) => <>{children}</>,
    Trigger: ({ children }: PropsWithChildren) => <>{children}</>,
    Content: ({ children }: PropsWithChildren) => <div>{children}</div>,
  },
  useAssistantRuntime: () => ({
    thread: { cancelRun: vi.fn(), reset: vi.fn() },
    threads: { mainItem: { rename: vi.fn().mockResolvedValue(undefined) } },
  }),
  useAuiState: (selector: (state: unknown) => unknown) => selector({
    thread: { isRunning: false, messages: [] },
    threadListItem: { id: "thread_test" },
  }),
  useAuiEvent: vi.fn(),
}));

vi.mock("./thread-list", () => ({
  AssistantThreadList: () => <aside>Thread list</aside>,
}));

vi.mock("./thread", () => ({
  AssistantThread: () => <main>Assistant thread</main>,
}));

vi.mock("./work-status", () => ({
  AssistantWorkStatus: () => <span>Assistant work status</span>,
}));

describe("assistant modal", () => {
  it("does not show a clear conversation header action", () => {
    render(<AssistantModal configured />);

    expect(screen.queryByRole("button", { name: "Clear conversation" })).not.toBeInTheDocument();
  });
});
