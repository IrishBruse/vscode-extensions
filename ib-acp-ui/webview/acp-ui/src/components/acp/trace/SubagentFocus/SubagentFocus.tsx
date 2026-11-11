import type { ReactElement, RefObject } from "react";
import type { WorkspacePathOpenTarget } from "../../../../../../../src/protocol/extensionHostMessages";
import type { TraceItem } from "../../../../chatReducer";
import { TraceList } from "../TraceList/TraceList";
import "./SubagentFocus.css";

/**
 * Child session view. Back returns to the parent transcript.
 */
export function SubagentFocus({
  title,
  status,
  description,
  items,
  showThoughts,
  expandAllToolOutputs,
  followBottom,
  historyCommit,
  traceScrollRef,
  onBack,
  onCollapseExpandAll,
  onOpenWorkspacePath,
  onOpenImage,
  onOpenSubagent,
  onOpenTask,
}: {
  title: string;
  status: string;
  description: string;
  items: TraceItem[];
  showThoughts: boolean;
  expandAllToolOutputs: boolean;
  followBottom: boolean;
  historyCommit: number;
  traceScrollRef: RefObject<HTMLElement | null>;
  onBack: () => void;
  onCollapseExpandAll?: () => void;
  onOpenWorkspacePath?: (path: string, options?: { target?: WorkspacePathOpenTarget }) => void;
  onOpenImage?: (src: string) => void;
  onOpenSubagent?: (sessionId: string) => void;
  onOpenTask?: (toolCallId: string) => void;
}): ReactElement {
  return (
    <section className="subagent-focus" aria-label={title}>
      <div className="subagent-focus-bar">
        <button type="button" className="subagent-focus-back" onClick={onBack}>
          Back
        </button>
        <span className="subagent-focus-status">{status}</span>
        <span className="subagent-focus-title">{title}</span>
      </div>
      {description.trim().length > 0 ? <p className="subagent-focus-description">{description}</p> : null}
      <TraceList
        items={items}
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
      />
    </section>
  );
}
