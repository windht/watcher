import {
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useToolCallElapsed,
  type ToolCallMessagePartComponent,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { ArrowDown, ArrowUp, Square } from "lucide-react";
import remarkGfm from "remark-gfm";
import { DotMatrix } from "../components/assistant-ui/dot-matrix";
import { CredentialToolUi, credentialRequestFromResult } from "./credential-tool-ui";
import { formatWorkDuration } from "./work-status";

export function AssistantThread() {
  return (
    <ThreadPrimitive.Root className="assistant-thread">
      <ThreadPrimitive.Viewport className="assistant-viewport">
        <ThreadPrimitive.Empty><Welcome /></ThreadPrimitive.Empty>
        <div className="assistant-messages">
          <ThreadPrimitive.Messages components={{ Message: ChatMessage }} />
        </div>
        <ThreadPrimitive.ViewportFooter className="assistant-footer">
          <ThreadPrimitive.ScrollToBottom asChild>
            <button type="button" className="assistant-scroll" aria-label="Scroll to bottom">
              <ArrowDown size={15} />
            </button>
          </ThreadPrimitive.ScrollToBottom>
          <Composer />
          <p>Secrets entered in tool forms stay outside model context.</p>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

function Welcome() {
  return (
    <div className="assistant-welcome">
      <div>✦</div>
      <h3>What API work can I handle?</h3>
      <p>Create and organize requests, send one or a list, inspect failures, and keep every run in Watcher History.</p>
      <span>Try “Make a POST request to https://api.example.com/items”</span>
    </div>
  );
}

function ChatMessage() {
  const role = useAuiState((state) => state.message.role);
  if (role === "system") return null;
  return (
    <MessagePrimitive.Root className={role === "user" ? "assistant-user-message" : "assistant-message"}>
      <MessagePrimitive.Parts components={{ Text: MarkdownText, tools: { Fallback: ToolFallback } }} />
      <MessagePrimitive.Error>
        <ErrorPrimitive.Root className="assistant-error"><ErrorPrimitive.Message /></ErrorPrimitive.Root>
      </MessagePrimitive.Error>
    </MessagePrimitive.Root>
  );
}

function MarkdownText() {
  return <MarkdownTextPrimitive remarkPlugins={[remarkGfm]} className="assistant-markdown" />;
}

const ToolFallback: ToolCallMessagePartComponent = ({ toolName, argsText, result, status }) => {
  const running = status?.type === "running";
  const failed = status?.type === "incomplete";
  const credentialRequest = credentialRequestFromResult(result);
  const elapsedMs = useToolCallElapsed();
  const statusLabel = credentialRequest
    ? "Needs credentials"
    : running
      ? "Working"
      : failed
        ? "Tool failed"
        : "Worked";
  const duration = elapsedMs === undefined ? null : formatWorkDuration(elapsedMs);
  return (
    <div className="assistant-tool">
      <details open={Boolean(running || failed || credentialRequest)}>
        <summary className="assistant-tool-summary">
          <DotMatrix
            state={running ? "loading" : failed ? "error" : "idle"}
            label={statusLabel + " " + toolName}
          />
          <span className="assistant-tool-summary-copy">
            <strong>{statusLabel}{duration && " for " + duration}</strong>
            <code>{toolName}</code>
          </span>
        </summary>
        {running && <p className="assistant-tool-pending">This tool is still working. Output will appear here.</p>}
        {argsText && <pre>{argsText}</pre>}
        {result !== undefined && !credentialRequest && (
          <pre>{typeof result === "string" ? result : JSON.stringify(result, null, 2)}</pre>
        )}
      </details>
      {credentialRequest && <CredentialToolUi request={credentialRequest} />}
    </div>
  );
};

function Composer() {
  return (
    <ComposerPrimitive.Root className="assistant-composer">
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        placeholder="Ask Watcher…"
        aria-label="Message Watcher assistant"
      />
      <AuiIf condition={(state) => !state.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <button type="button" aria-label="Send message"><ArrowUp size={16} /></button>
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(state) => state.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <button type="button" aria-label="Stop response"><Square size={13} fill="currentColor" /></button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </ComposerPrimitive.Root>
  );
}
