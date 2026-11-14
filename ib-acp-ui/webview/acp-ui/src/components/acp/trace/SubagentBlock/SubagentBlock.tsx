import type { ReactElement } from "react";
import { subagentTaskViewFromTool } from "../../../../../../../src/acp/mapping/taskToolPresentation";
import type { ToolCallStatus } from "../../../../../../../src/protocol/extensionHostMessages";
import { formatCompactDurationMs } from "../../../../../../../src/protocol/visibleTrace";
import type { SubagentTraceItem, TraceItem, TraceToolItem } from "../../../../chatReducer";
import "../../tools/ToolCallBlock/ToolCallBlock.css";
import { SubagentRunTimer } from "./SubagentRunTimer";
import { subagentStatusLabel, taskStatusLabel } from "./subagentStatus";
import "./SubagentBlock.css";

const activityPreviewLineCount = 3;

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

function activityPreview(items: readonly TraceItem[]): string[] {
  const lines: string[] = [];
  for (const item of items) {
    const line = activityLine(item);
    if (line !== undefined) {
      lines.push(line);
    }
  }
  return lines.slice(-activityPreviewLineCount);
}

function StatusGlyph({ status }: { status: ToolCallStatus }): ReactElement {
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

function taskGlyph(status: ToolCallStatus, stopReason: string | undefined): ToolCallStatus {
  if (stopReason === "unknown" || stopReason === "error" || stopReason === "cancelled") {
    return "failed";
  }
  if (stopReason === "requires_action") {
    return "in_progress";
  }
  return status;
}

function sessionGlyph(item: SubagentTraceItem): ToolCallStatus {
  if (item.state === "idle" && item.stopReason === "error") {
    return "failed";
  }
  if (item.state === "idle" && item.stopReason === "cancelled") {
    return "failed";
  }
  if (item.state === "idle") {
    return "completed";
  }
  if (item.state === "unknown") {
    return "failed";
  }
  return "in_progress";
}

export function taskIsLive(item: TraceToolItem): boolean {
  return (
    (item.status === "pending" || item.status === "in_progress") &&
    item.taskStopReason !== "unknown" &&
    item.taskStopReason !== "requires_action"
  );
}

/** Header for the open task view. The prompt stays on that view. */
export function openTaskHeader(item: TraceToolItem): {
  title: string;
  status: string;
  startedAtMs?: number;
  description: string;
  prompt: string;
} {
  const view = subagentTaskViewFromTool(item);
  const status = taskStatusLabel(item.status, item.taskStopReason);
  const duration =
    view?.durationMs !== undefined ? formatCompactDurationMs(view.durationMs) : "";
  const description = [view?.subagentType ?? "", duration].filter((part) => part.length > 0).join(" · ");
  return {
    title: view?.description ?? item.title,
    status,
    ...(taskIsLive(item) && item.startedAtMs !== undefined ? { startedAtMs: item.startedAtMs } : {}),
    description,
    prompt: view?.prompt ?? "",
  };
}

type SubagentCard = {
  glyph: ToolCallStatus;
  status: string;
  liveStartedAtMs?: number;
  title: string;
  detail: string;
  ariaLabel: string;
};

function cardFromTool(item: TraceToolItem): SubagentCard | undefined {
  const view = subagentTaskViewFromTool(item);
  if (view === undefined) {
    return undefined;
  }
  const live = taskIsLive(item);
  const status = taskStatusLabel(item.status, item.taskStopReason);
  const duration =
    live || view.durationMs === undefined ? "" : formatCompactDurationMs(view.durationMs);
  return {
    glyph: taskGlyph(item.status, item.taskStopReason),
    status,
    ...(live && item.startedAtMs !== undefined ? { liveStartedAtMs: item.startedAtMs } : {}),
    title: view.description,
    detail: [view.subagentType, duration].filter((part) => part.length > 0).join(" · "),
    ariaLabel: `Open subagent ${view.description}, ${status}`,
  };
}

function cardFromSession(item: SubagentTraceItem): SubagentCard {
  const status = subagentStatusLabel(item.state, item.stopReason);
  const title = item.title.trim().length > 0 ? item.title : "Subagent";
  const live = item.state === "running" && item.startedAtMs !== undefined;
  return {
    glyph: sessionGlyph(item),
    status,
    ...(live ? { liveStartedAtMs: item.startedAtMs } : {}),
    title,
    detail: item.description.trim(),
    ariaLabel: `Open subagent ${title}, ${status}`,
  };
}

/**
 * One card for a subagent. A Cursor task and an ACP child session use this same row.
 */
export function SubagentBlock({
  tool,
  session,
  activity,
  className,
  onOpen,
}: {
  tool?: TraceToolItem;
  session?: SubagentTraceItem;
  activity?: readonly TraceItem[];
  className?: string;
  onOpen?: () => void;
}): ReactElement | null {
  const card = tool !== undefined ? cardFromTool(tool) : session !== undefined ? cardFromSession(session) : undefined;
  if (card === undefined) {
    return null;
  }
  const lines = activityPreview(activity ?? []);
  const classNames = ["subagent-block", className].filter((part) => part !== undefined && part.length > 0);
  return (
    <button
      type="button"
      className={classNames.join(" ")}
      data-tool-id={tool?.toolCallId}
      data-subagent-id={session?.sessionId}
      data-status={tool?.status}
      data-subagent-state={session?.state ?? undefined}
      aria-label={card.ariaLabel}
      onClick={() => onOpen?.()}
    >
      <span className="subagent-block-line">
        <StatusGlyph status={card.glyph} />
        <span className="subagent-block-status">
          {card.liveStartedAtMs !== undefined ? (
            <SubagentRunTimer startedAtMs={card.liveStartedAtMs} />
          ) : (
            card.status
          )}
        </span>
        <span className="subagent-block-title">{card.title}</span>
      </span>
      {card.detail.length > 0 ? <span className="subagent-block-detail">{card.detail}</span> : null}
      {lines.map((line, index) => (
        <span key={`${index}:${line}`} className="subagent-block-activity">
          {line}
        </span>
      ))}
    </button>
  );
}
