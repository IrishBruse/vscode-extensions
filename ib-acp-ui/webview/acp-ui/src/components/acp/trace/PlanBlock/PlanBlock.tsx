import type { ReactElement } from "react";
import "./PlanBlock.css";
import type { PlanEntry } from "../../../../../../../src/protocol/extensionHostMessages";

type TodoStatusKind = "pending" | "in_progress" | "completed" | "cancelled";

function todoStatusKind(status: string): TodoStatusKind {
  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "in_progress" || normalized === "inprogress") {
    return "in_progress";
  }
  if (normalized === "completed" || normalized === "complete" || normalized === "done") {
    return "completed";
  }
  if (normalized === "cancelled" || normalized === "canceled") {
    return "cancelled";
  }
  return "pending";
}

function todoStatusLabel(kind: TodoStatusKind): string {
  if (kind === "in_progress") {
    return "In progress";
  }
  if (kind === "completed") {
    return "Complete";
  }
  if (kind === "cancelled") {
    return "Cancelled";
  }
  return "Pending";
}

function TodoStatusMark({ status }: { status: string }): ReactElement {
  const kind = todoStatusKind(status);
  const label = todoStatusLabel(kind);
  return (
    <span className={`agent-plan-mark agent-plan-mark--${kind}`} role="img" aria-label={label}>
      {kind === "completed" ? (
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.2 6.2 4.8 8.8 9.8 3.2" />
        </svg>
      ) : null}
      {kind === "cancelled" ? (
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3 9 9M9 3 3 9" />
        </svg>
      ) : null}
    </span>
  );
}

/**
 * Renders an ACP agent plan as a TODO list.
 * Each row uses a mark for pending, in progress, complete, or cancelled.
 */
export function PlanBlock({
  entries,
  className,
}: {
  entries: PlanEntry[];
  className?: string;
}): ReactElement {
  return (
    <div
      className={
        className === undefined || className.length === 0 ? "agent-plan" : `agent-plan ${className}`
      }
      aria-label="TODO"
    >
      <div className="agent-plan-title">TODO</div>
      {entries.map((entry, index) => {
        const kind = todoStatusKind(entry.status);
        const priority =
          entry.priority !== undefined && entry.priority.length > 0
            ? `Priority ${entry.priority}`
            : undefined;
        return (
          <div
            key={index}
            className={`agent-plan-row agent-plan-row--${kind}`}
            title={priority}
          >
            <TodoStatusMark status={entry.status} />
            <span className="agent-plan-content">{entry.content}</span>
          </div>
        );
      })}
    </div>
  );
}
