import type { ReactElement } from "react";
import type { SubagentTraceItem } from "../../../../chatReducer";
import { subagentStatusLabel } from "./subagentStatus";
import "./SubagentSessionBlock.css";

/**
 * Parent-chat row for one ACP child session.
 * The status is visible before the row is opened.
 */
export function SubagentSessionBlock({
  item,
  className,
  onOpen,
}: {
  item: SubagentTraceItem;
  className?: string;
  onOpen?: (sessionId: string) => void;
}): ReactElement {
  const status = subagentStatusLabel(item.state, item.stopReason);
  const title = item.title.trim().length > 0 ? item.title : "Subagent";
  const classNames = ["subagent-session", className].filter((part) => part !== undefined && part.length > 0);
  return (
    <button
      type="button"
      className={classNames.join(" ")}
      data-subagent-id={item.sessionId}
      data-subagent-state={item.state ?? "unknown"}
      aria-label={`Open subagent ${title}, ${status}`}
      onClick={() => onOpen?.(item.sessionId)}
    >
      <span className="subagent-session-status">{status}</span>
      <span className="subagent-session-title">{title}</span>
      {item.description.trim().length > 0 ? (
        <span className="subagent-session-description">{item.description}</span>
      ) : null}
    </button>
  );
}
