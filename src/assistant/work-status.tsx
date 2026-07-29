import { useEffect, useState } from "react";
import { useAuiEvent, useAuiState, type MessageTiming } from "@assistant-ui/react";
import { DotMatrix } from "../components/assistant-ui/dot-matrix";

type FallbackRun = {
  threadId: string;
  startedAt: number;
  completedAt?: number;
};

export function formatWorkDuration(durationMs: number) {
  const totalSeconds = Math.max(1, Math.floor(Math.max(0, durationMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return String(seconds) + "s";
  return seconds === 0
    ? String(minutes) + "m"
    : String(minutes) + "m " + String(seconds) + "s";
}

export function getWorkElapsed({
  isRunning,
  timing,
  fallbackRun,
  now,
}: {
  isRunning: boolean;
  timing?: MessageTiming;
  fallbackRun?: FallbackRun;
  now: number;
}) {
  const startedAt = fallbackRun?.startedAt ?? timing?.streamStartTime;
  if (startedAt === undefined) return undefined;
  if (isRunning) return Math.max(0, now - startedAt);
  if (fallbackRun?.completedAt !== undefined) {
    return Math.max(0, fallbackRun.completedAt - startedAt);
  }
  if (timing?.totalStreamTime !== undefined) return timing.totalStreamTime;
  return undefined;
}

export function AssistantWorkStatus() {
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const threadId = useAuiState((state) => state.threadListItem.id);
  const timing = useAuiState((state) => {
    for (let index = state.thread.messages.length - 1; index >= 0; index--) {
      const message = state.thread.messages[index];
      if (message.role !== "assistant") continue;
      if (state.thread.isRunning && message.status?.type !== "running") continue;
      return message.metadata.timing;
    }
    return undefined;
  });
  const [fallbackRun, setFallbackRun] = useState<FallbackRun | undefined>();
  const [now, setNow] = useState(Date.now);

  useAuiEvent("thread.runStart", ({ threadId: runThreadId }) => {
    setFallbackRun({ threadId: runThreadId, startedAt: Date.now() });
  });
  useAuiEvent("thread.runEnd", ({ threadId: runThreadId }) => {
    setFallbackRun((current) => current?.threadId === runThreadId
      ? { ...current, completedAt: Date.now() }
      : current);
  });
  useAuiEvent("threadListItem.switchedTo", ({ threadId: nextThreadId }) => {
    setFallbackRun((current) => current?.threadId === nextThreadId ? current : undefined);
  });

  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const currentFallbackRun = fallbackRun?.threadId === threadId ? fallbackRun : undefined;
  const elapsedMs = getWorkElapsed({ isRunning, timing, fallbackRun: currentFallbackRun, now });
  return <AssistantWorkStatusView isRunning={isRunning} elapsedMs={elapsedMs} />;
}

export function AssistantWorkStatusView({
  isRunning,
  elapsedMs,
}: {
  isRunning: boolean;
  elapsedMs?: number;
}) {
  if (elapsedMs === undefined) return null;

  const duration = formatWorkDuration(elapsedMs);
  const status = isRunning ? "Working" : "Worked";
  return (
    <div
      className="assistant-work-status"
      data-running={isRunning}
      aria-label={status + " for " + duration}
    >
      <DotMatrix
        state={isRunning ? "loading" : "idle"}
        label={isRunning ? "Assistant is working" : "Assistant has finished working"}
      />
      <span className="assistant-work-status-copy">
        <strong>{status}</strong>
        <span>for {duration}</span>
      </span>
    </div>
  );
}
