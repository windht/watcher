import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantThreadList } from "./thread-list";

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  state: {
    current: {
      threads: {
        threadIds: ["thread-1"],
        newThreadId: undefined as string | undefined,
        threadItems: [{ id: "thread-1", title: "hi" }],
      },
      threadListItem: { id: "thread-1", title: "hi" as string | undefined },
      thread: { messages: [] as { role: string; content: { type: string; text: string }[] }[] },
    },
  },
  runtime: {
    threads: {
      switchToNewThread: vi.fn(),
      switchToThread: vi.fn(),
      getItemById: vi.fn(),
      mainItem: { rename: vi.fn() },
    },
  },
}));

vi.mock("@assistant-ui/react", () => ({
  useAssistantRuntime: () => mocks.runtime,
  useAuiState: (selector: (state: unknown) => unknown) => selector(mocks.state.current),
}));

describe("assistant thread list", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.state.current = {
      threads: {
        threadIds: ["thread-1"],
        newThreadId: undefined,
        threadItems: [{ id: "thread-1", title: "hi" }],
      },
      threadListItem: { id: "thread-1", title: "hi" },
      thread: { messages: [] },
    };
    mocks.runtime.threads.getItemById.mockReturnValue({ delete: mocks.delete });
  });

  it("deletes a conversation from its sidebar row", () => {
    render(<AssistantThreadList />);
    fireEvent.click(screen.getByRole("button", { name: 'Delete thread "hi"' }));
    expect(mocks.runtime.threads.getItemById).toHaveBeenCalledWith("thread-1");
    expect(mocks.delete).toHaveBeenCalledOnce();
  });

  it("does not replace a deleted conversation with an empty New Thread row", () => {
    mocks.delete.mockImplementation(() => {
      mocks.state.current = {
        threads: {
          threadIds: [],
          newThreadId: "new-thread",
          threadItems: [],
        },
        threadListItem: { id: "new-thread", title: undefined },
        thread: { messages: [] },
      };
    });
    const view = render(<AssistantThreadList />);

    fireEvent.click(screen.getByRole("button", { name: 'Delete thread "hi"' }));
    view.rerender(<AssistantThreadList />);

    expect(screen.queryByText("New Thread")).not.toBeInTheDocument();
    expect(screen.getByText("No conversations yet.")).toBeInTheDocument();
  });
});
