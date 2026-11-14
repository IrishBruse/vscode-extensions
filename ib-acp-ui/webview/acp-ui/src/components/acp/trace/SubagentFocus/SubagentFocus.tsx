import type { ReactElement, RefObject } from "react";
import type { WorkspacePathOpenTarget } from "../../../../../../../src/protocol/extensionHostMessages";
import type { TraceItem } from "../../../../chatReducer";
import { SubagentRunTimer } from "../SubagentBlock/SubagentRunTimer";
import { TraceList } from "../TraceList/TraceList";
import "./SubagentFocus.css";

/**
 * Child session view. Back returns to the parent transcript.
 */
export function SubagentFocus({
  title,
  status,
  startedAtMs,
  description,
  prompt,
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
  taskActivityByToolId,
  subagentSessionByToolId,
}: {
  title: string;
  status: string;
  startedAtMs?: number;
  description: string;
  prompt?: string;
  items: readonly TraceItem[];
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
  taskActivityByToolId?: ReadonlyMap<string, readonly TraceItem[]>;
  subagentSessionByToolId?: ReadonlyMap<string, string>;
}): ReactElement {
  return (
    <section className="subagent-focus" aria-label={title}>
      <div className="subagent-focus-bar">
        <button type="button" className="subagent-focus-back" onClick={onBack}>
          Back
        </button>
        <span className="subagent-focus-status">
          {startedAtMs !== undefined ? <SubagentRunTimer startedAtMs={startedAtMs} /> : status}
        </span>
        <span className="subagent-focus-title">{title}</span>
      </div>
      {description.trim().length > 0 ? <p className="subagent-focus-description">{description}</p> : null}
      {prompt !== undefined && prompt.trim().length > 0 ? (
        <pre className="subagent-focus-prompt">{prompt}</pre>
      ) : null}
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
        taskActivityByToolId={taskActivityByToolId}
        subagentSessionByToolId={subagentSessionByToolId}
      />
    </section>
  );
}
