import { type ReactElement, useEffect, useRef, useState } from "react";
import { subagentTaskViewFromTool } from "../../../../../../../src/acp/mapping/taskToolPresentation";
import type { ToolCallStatus } from "../../../../../../../src/protocol/extensionHostMessages";
import { formatCompactDurationMs } from "../../../../../../../src/protocol/visibleTrace";
import type { TraceItem, TraceToolItem } from "../../../../chatReducer";
import { taskStatusLabel } from "../../trace/SubagentSessionBlock/subagentStatus";
import "../ToolCallBlock/ToolCallBlock.css";
import "./SubagentTaskBlock.css";

const promptPreviewLineCount = 4;
const activityPreviewLineCount = 8;

function activityLine(item: TraceItem): string | undefined {
  if (item.type === "agent" || item.type === "thought") {
    const text = item.text.replace(/\s+/g, " ").trim();
    if (text.length === 0) {
      return undefined;
    }
    return text.length > 160 ? `${text.slice(0, 157)}...` : text;
  }
  if (item.type === "tool") {
    const title = item.title.trim();
    return title.length > 0 ? title : undefined;
  }
  return undefined;
}

export function subagentActivityPreview(items: readonly TraceItem[], limit?: number): string[] {
  const lines: string[] = [];
  for (const item of items) {
    const line = activityLine(item);
    if (line !== undefined) {
      lines.push(line);
    }
  }
  return limit === undefined ? lines : lines.slice(-limit);
}

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
  onOpen,
  activity,
  className,
}: {
  item: TraceToolItem;
  expandAllToolOutputs: boolean;
  onCollapseExpandAll?: () => void;
  onOpen?: (toolCallId: string) => void;
  activity?: readonly TraceItem[];
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
  const running = item.status === "pending" || item.status === "in_progress";
  const durationLabel =
    running || view.durationMs === undefined ? "" : formatCompactDurationMs(view.durationMs);
  const activityLines = subagentActivityPreview(activity ?? [], activityPreviewLineCount);
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
      aria-label={`Subagent task: ${view.description}, ${taskStatusLabel(item.status, item.taskStopReason)}`}
    >
      <div className="subagent-task-line">
        <TaskStatusGlyph status={item.status} />
        <span className="subagent-task-label">Task</span>
        <span className="subagent-task-status">
          {taskStatusLabel(item.status, item.taskStopReason)}
        </span>
        <span className="subagent-task-description">{view.description}</span>
        <button
          type="button"
          className="subagent-task-expand"
          onClick={() => onOpen?.(item.toolCallId)}
        >
          Open
        </button>
      </div>
      {meta.length > 0 ? <div className="subagent-task-meta">{meta}</div> : null}
      {activityLines.length > 0 ? (
        <div className="subagent-task-activity">
          {activityLines.map((line, index) => (
            <div key={`${index}:${line}`} className="subagent-task-activity-line">
              {line}
            </div>
          ))}
        </div>
      ) : null}
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
