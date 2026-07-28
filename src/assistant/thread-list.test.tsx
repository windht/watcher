import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantThreadList } from "./thread-list";

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
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
  useAuiState: (selector: (state: unknown) => unknown) => selector({
    threads: {
      threadIds: ["thread-1"],
      newThreadId: undefined,
      threadItems: [{ id: "thread-1", title: "hi" }],
    },
    threadListItem: { id: "thread-1", title: "hi" },
    thread: { messages: [] },
  }),
}));

describe("assistant thread list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runtime.threads.getItemById.mockReturnValue({ delete: mocks.delete });
  });

  it("deletes a conversation from its sidebar row", () => {
    render(<AssistantThreadList />);
    fireEvent.click(screen.getByRole("button", { name: 'Delete thread "hi"' }));
    expect(mocks.runtime.threads.getItemById).toHaveBeenCalledWith("thread-1");
    expect(mocks.delete).toHaveBeenCalledOnce();
  });
});
