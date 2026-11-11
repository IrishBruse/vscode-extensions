import type { ReactElement, RefObject } from "react";
import { subagentTaskViewFromTool } from "../../../../../../../src/acp/mapping/taskToolPresentation";
import type { WorkspacePathOpenTarget } from "../../../../../../../src/protocol/extensionHostMessages";
import { formatCompactDurationMs } from "../../../../../../../src/protocol/visibleTrace";
import type { TraceItem, TraceToolItem } from "../../../../chatReducer";
import { SubagentRunTimer } from "../SubagentSessionBlock/SubagentRunTimer";
import { taskStatusLabel } from "../SubagentSessionBlock/subagentStatus";
import { TraceList } from "../TraceList/TraceList";
import "../../tools/SubagentTaskBlock/SubagentTaskBlock.css";
import "./SubagentFocus.css";

/**
 * Open view for a Cursor task card. The prompt stays above the child's live transcript.
 */
export function TaskFocus({
  item,
  activity,
  onBack,
  showThoughts,
  expandAllToolOutputs,
  followBottom,
  historyCommit,
  traceScrollRef,
  onCollapseExpandAll,
  onOpenWorkspacePath,
  onOpenImage,
  onOpenSubagent,
  onOpenTask,
  taskActivityByToolId,
}: {
  item: TraceToolItem;
  activity?: readonly TraceItem[];
  onBack: () => void;
  showThoughts: boolean;
  expandAllToolOutputs: boolean;
  followBottom: boolean;
  historyCommit: number;
  traceScrollRef: RefObject<HTMLElement | null>;
  onCollapseExpandAll?: () => void;
  onOpenWorkspacePath?: (path: string, options?: { target?: WorkspacePathOpenTarget }) => void;
  onOpenImage?: (src: string) => void;
  onOpenSubagent?: (sessionId: string) => void;
  onOpenTask?: (toolCallId: string) => void;
  taskActivityByToolId?: ReadonlyMap<string, readonly TraceItem[]>;
}): ReactElement {
  const view = subagentTaskViewFromTool(item);
  const status = taskStatusLabel(item.status, item.taskStopReason);
  const running =
    (item.status === "pending" || item.status === "in_progress") &&
    item.taskStopReason !== "unknown" &&
    item.taskStopReason !== "requires_action" &&
    item.startedAtMs !== undefined;
  const title = view?.description ?? item.title;
  const duration =
    view?.durationMs !== undefined ? formatCompactDurationMs(view.durationMs) : "";
  const meta = [view?.subagentType ?? "", duration].filter((part) => part.length > 0).join(" · ");
  return (
    <section className="subagent-focus" aria-label={title}>
      <div className="subagent-focus-bar">
        <button type="button" className="subagent-focus-back" onClick={onBack}>
          Back
        </button>
        <span className="subagent-focus-status">
          {running && item.startedAtMs !== undefined ? (
            <SubagentRunTimer startedAtMs={item.startedAtMs} />
          ) : (
            status
          )}
        </span>
        <span className="subagent-focus-title">{title}</span>
      </div>
      {meta.length > 0 ? <p className="subagent-focus-description">{meta}</p> : null}
      {view !== undefined && view.prompt.trim().length > 0 ? (
        <pre className="subagent-task-prompt">{view.prompt}</pre>
      ) : null}
      <TraceList
        items={activity ?? []}
        showThoughts={showThoughts}
        expandAllToolOutputs={expandAllToolOutputs}
        followBottom={followBottom}
        historyCommit={historyCommit}
        traceScrollRef={traceScrollRef}
        onCollapseExpandAll={onCollapseExpandAll}
        onOpenWorkspacePath={onOpenWorkspacePath}
        onOpenImage={onOpenImage}
        onOpenSubagent={onOpenSubagent}
        onOpenTask={onOpenTask}
        taskActivityByToolId={taskActivityByToolId}
      />
    </section>
  );
}
