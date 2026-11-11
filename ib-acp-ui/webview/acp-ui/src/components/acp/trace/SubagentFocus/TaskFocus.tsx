import type { ReactElement } from "react";
import { subagentTaskViewFromTool } from "../../../../../../../src/acp/mapping/taskToolPresentation";
import { formatCompactDurationMs } from "../../../../../../../src/protocol/visibleTrace";
import type { TraceItem, TraceToolItem } from "../../../../chatReducer";
import { subagentActivityPreview } from "../../tools/SubagentTaskBlock/SubagentTaskBlock";
import { taskStatusLabel } from "../SubagentSessionBlock/subagentStatus";
import "../../tools/SubagentTaskBlock/SubagentTaskBlock.css";
import "./SubagentFocus.css";

/**
 * Open view for a Cursor task card. Back returns to the parent transcript.
 */
export function TaskFocus({
  item,
  activity,
  onBack,
}: {
  item: TraceToolItem;
  activity?: readonly TraceItem[];
  onBack: () => void;
}): ReactElement {
  const view = subagentTaskViewFromTool(item);
  const status = taskStatusLabel(item.status, item.taskStopReason);
  const activityLines = subagentActivityPreview(activity ?? []);
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
        <span className="subagent-focus-status">{status}</span>
        <span className="subagent-focus-title">{title}</span>
      </div>
      {meta.length > 0 ? <p className="subagent-focus-description">{meta}</p> : null}
      {activityLines.length > 0 ? (
        <div className="subagent-task-activity">
          {activityLines.map((line, index) => (
            <div key={`${index}:${line}`} className="subagent-task-activity-line">
              {line}
            </div>
          ))}
        </div>
      ) : null}
      {view !== undefined && view.prompt.trim().length > 0 ? (
        <pre className="subagent-task-prompt">{view.prompt}</pre>
      ) : null}
    </section>
  );
}
