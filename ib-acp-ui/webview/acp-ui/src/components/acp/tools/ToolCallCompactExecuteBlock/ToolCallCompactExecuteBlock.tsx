import { type ReactElement, useEffect, useRef, useState } from "react";
import {
  formatCompactDurationMs,
  formatThoughtSeconds,
} from "../../../../../../../src/protocol/visibleTrace";
import "./ToolCallCompactExecuteBlock.css";
import { ShellCommandHighlight } from "../../../../ShellCommandHighlight";
import type { TraceToolItem } from "../../../../chatReducer";
import {
  compactExecutePreviewLineCount,
  executeCommandText,
  executeOutputPreview,
} from "../../../../toolCallCompactText";

function BashRunTimer({ startedAtMs }: { startedAtMs: number }): ReactElement {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const handle = window.setInterval(() => {
      setNowMs(Date.now());
    }, 100);
    return () => {
      window.clearInterval(handle);
    };
  }, []);
  const seconds = formatThoughtSeconds(Math.max(0, nowMs - startedAtMs));
  const label = seconds.length > 0 ? `Running for ${seconds}` : "Running";
  return <span className="tool-call-compact-execute-duration"> {label}</span>;
}

/**
 * Compact terminal tool: the command stays on the `$` line.
 * Output sits in a separate block. A long result opens from Show output.
 */
export function ToolCallCompactExecuteBlock({
  item,
  expandAllToolOutputs,
  onCollapseExpandAll,
  className,
}: {
  item: TraceToolItem;
  expandAllToolOutputs: boolean;
  onCollapseExpandAll?: () => void;
  className?: string;
}): ReactElement {
  const [localExpanded, setLocalExpanded] = useState(false);
  const prevExpandAllRef = useRef(expandAllToolOutputs);
  useEffect(() => {
    if (prevExpandAllRef.current && !expandAllToolOutputs) {
      setLocalExpanded(false);
    }
    prevExpandAllRef.current = expandAllToolOutputs;
  }, [expandAllToolOutputs]);

  const expanded = expandAllToolOutputs || localExpanded;
  const command = executeCommandText(item);
  const { previewLines, totalLineCount } = executeOutputPreview(item, expanded);
  const canToggle = totalLineCount > compactExecutePreviewLineCount;
  const inProgress = item.status === "pending" || item.status === "in_progress";
  const durationLabel =
    item.durationMs !== undefined ? formatCompactDurationMs(item.durationMs) : "";
  const showRunTimer = inProgress && item.startedAtMs !== undefined;
  const toggleOutput = (): void => {
    if (expanded) {
      setLocalExpanded(false);
      if (expandAllToolOutputs) {
        onCollapseExpandAll?.();
      }
      return;
    }
    setLocalExpanded(true);
  };

  return (
    <div
      className={
        className === undefined || className.length === 0
          ? "tool-call-compact-execute"
          : `tool-call-compact-execute ${className}`
      }
      data-tool-id={item.toolCallId}
      data-status={item.status}
      role="status"
      aria-label="Terminal command"
    >
      <div className="tool-call-compact-execute-command">
        <span className="tool-call-compact-execute-prompt" aria-hidden="true">
          $
        </span>
        <span className="tool-call-compact-execute-command-text">
          {command.length > 0 ? <ShellCommandHighlight command={command} /> : "Terminal"}
          {showRunTimer && item.startedAtMs !== undefined ? (
            <BashRunTimer startedAtMs={item.startedAtMs} />
          ) : durationLabel.length > 0 ? (
            <span className="tool-call-compact-execute-duration"> {durationLabel}</span>
          ) : null}
        </span>
      </div>
      {canToggle ? (
        <button
          type="button"
          className="tool-call-compact-execute-toggle"
          aria-expanded={expanded}
          onClick={toggleOutput}
        >
          {expanded ? "Hide output" : "Show output"}
        </button>
      ) : null}
      {previewLines.length > 0 ? (
        <pre className="tool-call-compact-execute-output" aria-label="Command output">
          {previewLines.join("\n")}
        </pre>
      ) : null}
      {inProgress && !showRunTimer && previewLines.length === 0 ? (
        <div className="tool-call-compact-execute-running">Running…</div>
      ) : null}
    </div>
  );
}
