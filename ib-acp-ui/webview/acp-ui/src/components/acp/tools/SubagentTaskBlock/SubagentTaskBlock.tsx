import { type ReactElement, useEffect, useRef, useState } from "react";
import { subagentTaskViewFromTool } from "../../../../../../../src/acp/mapping/taskToolPresentation";
import type { ToolCallStatus } from "../../../../../../../src/protocol/extensionHostMessages";
import { formatCompactDurationMs } from "../../../../../../../src/protocol/visibleTrace";
import type { TraceToolItem } from "../../../../chatReducer";
import "../ToolCallBlock/ToolCallBlock.css";
import "./SubagentTaskBlock.css";

const promptPreviewLineCount = 4;

function TaskStatusGlyph({ status }: { status: ToolCallStatus }): ReactElement {
  if (status === "in_progress" || status === "pending") {
    return (
      <span
        className="tool-call-terminal-status tool-call-terminal-status--in-progress"
        aria-hidden="true"
      />
    );
  }
  if (status === "completed") {
    return (
      <span
        className="tool-call-terminal-status tool-call-terminal-status--completed"
        aria-hidden="true"
      />
    );
  }
  return (
    <span className="tool-call-terminal-status tool-call-terminal-status--failed" aria-hidden="true">
      {"\u2715"}
    </span>
  );
}

/**
 * Subagent task card: short description, subagent type, and the prompt.
 */
export function SubagentTaskBlock({
  item,
  expandAllToolOutputs,
  onCollapseExpandAll,
  className,
}: {
  item: TraceToolItem;
  expandAllToolOutputs: boolean;
  onCollapseExpandAll?: () => void;
  className?: string;
}): ReactElement | null {
  const view = subagentTaskViewFromTool(item);
  const [localExpanded, setLocalExpanded] = useState(false);
  const prevExpandAllRef = useRef(expandAllToolOutputs);
  useEffect(() => {
    if (prevExpandAllRef.current && !expandAllToolOutputs) {
      setLocalExpanded(false);
    }
    prevExpandAllRef.current = expandAllToolOutputs;
  }, [expandAllToolOutputs]);
  if (view === undefined) {
    return null;
  }
  const expanded = expandAllToolOutputs || localExpanded;
  const promptLines = view.prompt.split(/\r?\n/);
  const collapsible = promptLines.length > promptPreviewLineCount;
  const shownPrompt =
    collapsible && !expanded
      ? promptLines.slice(0, promptPreviewLineCount).join("\n")
      : view.prompt;
  const durationLabel =
    view.durationMs !== undefined ? formatCompactDurationMs(view.durationMs) : "";
  const meta = [view.subagentType, durationLabel].filter((part) => part.length > 0).join(" · ");

  return (
    <div
      className={
        className === undefined || className.length === 0
          ? "subagent-task"
          : `subagent-task ${className}`
      }
      data-tool-id={item.toolCallId}
      data-status={item.status}
      role="status"
      aria-label={`Subagent task: ${view.description}`}
    >
      <div className="subagent-task-line">
        <TaskStatusGlyph status={item.status} />
        <span className="subagent-task-label">Task</span>
        <span className="subagent-task-description">{view.description}</span>
      </div>
      {meta.length > 0 ? <div className="subagent-task-meta">{meta}</div> : null}
      {shownPrompt.trim().length > 0 ? (
        <pre className="subagent-task-prompt">{shownPrompt}</pre>
      ) : null}
      {collapsible ? (
        <button
          type="button"
          className="subagent-task-expand"
          onClick={() => {
            if (expanded) {
              setLocalExpanded(false);
              if (expandAllToolOutputs) {
                onCollapseExpandAll?.();
              }
            } else {
              setLocalExpanded(true);
            }
          }}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      ) : null}
    </div>
  );
}
