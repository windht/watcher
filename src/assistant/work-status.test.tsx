import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AssistantWorkStatusView, formatWorkDuration, getWorkElapsed } from "./work-status";

describe("assistant work status", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a live working duration and retains the completed duration", () => {
    const view = render(<AssistantWorkStatusView isRunning elapsedMs={0} />);

    expect(screen.getByText("Working")).toBeInTheDocument();
    expect(screen.getByText("for 1s")).toBeInTheDocument();
    expect(view.container.querySelector('[data-slot="dot-matrix"]')).toHaveAttribute("data-state", "loading");

    view.rerender(<AssistantWorkStatusView isRunning={false} elapsedMs={2400} />);
    expect(screen.getByText("Worked")).toBeInTheDocument();
    expect(screen.getByText("for 2s")).toBeInTheDocument();
    expect(view.container.querySelector('[data-slot="dot-matrix"]')).toHaveAttribute("data-state", "idle");
  });

  it("does not render a stale status when no run timing belongs to this thread", () => {
    render(<AssistantWorkStatusView isRunning={false} elapsedMs={undefined} />);
    expect(screen.queryByText("Worked")).not.toBeInTheDocument();
  });

  it("uses the live stream timing and falls back to the run lifecycle timing", () => {
    expect(getWorkElapsed({
      isRunning: true,
      timing: {
        streamStartTime: 1000,
        totalChunks: 0,
        toolCallCount: 0,
      },
      now: 3400,
    })).toBe(2400);

    expect(getWorkElapsed({
      isRunning: false,
      fallbackRun: {
        threadId: "thread-1",
        startedAt: 1000,
        completedAt: 3400,
      },
      now: 4000,
    })).toBe(2400);

    expect(getWorkElapsed({
      isRunning: false,
      timing: {
        streamStartTime: 1000,
        totalStreamTime: 1400,
        totalChunks: 1,
        toolCallCount: 0,
      },
      fallbackRun: {
        threadId: "thread-1",
        startedAt: 500,
        completedAt: 3000,
      },
      now: 4000,
    })).toBe(2500);
  });

  it("formats compact minute and second durations", () => {
    expect(formatWorkDuration(60000)).toBe("1m");
    expect(formatWorkDuration(64000)).toBe("1m 4s");
  });
});
