import { type ReactElement, useEffect, useRef, useState } from "react";
import {
  formatCompactDurationMs,
  formatThoughtSeconds,
} from "../../../../../../../src/protocol/visibleTrace";
import { useLiveNow } from "../../../../liveClock";
import "./ToolCallCompactExecuteBlock.css";
import { ShellCommandHighlight } from "../../../../ShellCommandHighlight";
import type { TraceToolItem } from "../../../../chatReducer";
import {
  compactExecuteCommandLineCount,
  compactExecutePreviewLineCount,
  executeCommandPreview,
  executeCommandText,
  executeOutputPreview,
  executeWorkingDirectoryLabel,
} from "../../../../toolCallCompactText";

function BashRunTimer({ startedAtMs }: { startedAtMs: number }): ReactElement {
  const nowMs = useLiveNow(true);
  const seconds = formatThoughtSeconds(Math.max(0, nowMs - startedAtMs));
  const label = seconds.length > 0 ? `Running for ${seconds}` : "Running";
  return <span className="tool-call-compact-execute-duration">{label}</span>;
}

/**
 * Compact terminal tool.
 * The working directory and elapsed time sit on the first line, then the command under `$`.
 * Output sits in a separate block. Long commands and results each have their own Show control.
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
  const [localOutputExpanded, setLocalOutputExpanded] = useState(false);
  const [localCommandExpanded, setLocalCommandExpanded] = useState(false);
  const prevExpandAllRef = useRef(expandAllToolOutputs);
  useEffect(() => {
    if (prevExpandAllRef.current && !expandAllToolOutputs) {
      setLocalOutputExpanded(false);
      setLocalCommandExpanded(false);
    }
    prevExpandAllRef.current = expandAllToolOutputs;
  }, [expandAllToolOutputs]);

  const outputExpanded = expandAllToolOutputs || localOutputExpanded;
  const commandExpanded = expandAllToolOutputs || localCommandExpanded;
  const command = executeCommandText(item);
  const {
    previewLines: commandLines,
    totalLineCount: commandLineCount,
  } = executeCommandPreview(command, commandExpanded);
  const commandPreviewText = commandLines.join("\n");
  const { previewLines, totalLineCount } = executeOutputPreview(item, outputExpanded);
  const canToggleOutput = totalLineCount > compactExecutePreviewLineCount;
  const canToggleCommand = commandLineCount > compactExecuteCommandLineCount;
  const inProgress = item.status === "pending" || item.status === "in_progress";
  const durationLabel =
    item.durationMs !== undefined ? formatCompactDurationMs(item.durationMs) : "";
  const showRunTimer = inProgress && item.startedAtMs !== undefined;
  const cwdLabel = executeWorkingDirectoryLabel(item.cwd);
  const duration =
    showRunTimer && item.startedAtMs !== undefined ? (
      <BashRunTimer startedAtMs={item.startedAtMs} />
    ) : durationLabel.length > 0 ? (
      <span className="tool-call-compact-execute-duration">{durationLabel}</span>
    ) : null;
  const toggleOutput = (): void => {
    if (outputExpanded) {
      setLocalOutputExpanded(false);
      if (expandAllToolOutputs) {
        onCollapseExpandAll?.();
      }
      return;
    }
    setLocalOutputExpanded(true);
  };

  const toggleCommand = (): void => {
    if (commandExpanded) {
      setLocalCommandExpanded(false);
      if (expandAllToolOutputs) {
        onCollapseExpandAll?.();
      }
      return;
    }
    setLocalCommandExpanded(true);
  };

  const commandToggle = canToggleCommand ? (
    <button
      type="button"
      className="tool-call-compact-execute-toggle"
      aria-expanded={commandExpanded}
      onClick={toggleCommand}
    >
      {commandExpanded ? "Hide full command" : "Show full command"}
    </button>
  ) : null;
  const outputToggle = canToggleOutput ? (
    <button
      type="button"
      className="tool-call-compact-execute-toggle"
      aria-expanded={outputExpanded}
      onClick={toggleOutput}
    >
      {outputExpanded ? "Hide output" : "Show output"}
    </button>
  ) : null;
  const togglesBesideCommand = outputExpanded ? commandToggle : (
    <>
      {commandToggle}
      {outputToggle}
    </>
  );

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
      {cwdLabel.length > 0 || duration !== null ? (
        <div className="tool-call-compact-execute-meta">
          {cwdLabel.length > 0 ? (
            <span className="tool-call-compact-execute-cwd">{cwdLabel}</span>
          ) : null}
          {duration}
        </div>
      ) : null}
      <div className="tool-call-compact-execute-command">
        <span className="tool-call-compact-execute-prompt" aria-hidden="true">
          $
        </span>
        <span className="tool-call-compact-execute-command-text">
          {commandPreviewText.length > 0 ? (
            <ShellCommandHighlight command={commandPreviewText} />
          ) : (
            "Terminal"
          )}
        </span>
      </div>
      {commandToggle !== null || (outputToggle !== null && !outputExpanded) ? (
        <div className="tool-call-compact-execute-toggles" role="group" aria-label="Command details">
          {togglesBesideCommand}
        </div>
      ) : null}
      {previewLines.length > 0 ? (
        <pre className="tool-call-compact-execute-output" aria-label="Command output">
          {previewLines.join("\n")}
        </pre>
      ) : null}
      {outputExpanded && outputToggle !== null ? (
        <div className="tool-call-compact-execute-toggles" role="group" aria-label="Command details">
          {outputToggle}
        </div>
      ) : null}
      {inProgress && !showRunTimer && previewLines.length === 0 ? (
        <div className="tool-call-compact-execute-running">Running…</div>
      ) : null}
    </div>
  );
}
