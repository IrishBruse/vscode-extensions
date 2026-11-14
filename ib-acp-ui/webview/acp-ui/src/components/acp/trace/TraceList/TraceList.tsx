import {
  lazy,
  memo,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import "./TraceList.css";
import type { WorkspacePathOpenTarget } from "../../../../../../../src/protocol/extensionHostMessages";
import type { TraceItem, TraceToolItem } from "../../../../chatReducer";
import {
  previousThoughtIndexToCollapse,
  rectIntersectsScrollport,
  rectIsFullyAboveScrollport,
} from "./thoughtCollapse";
import { activityGroupRanges, isActivityTraceType } from "./traceActivityGroup";
import { promptImageSrc } from "../../../../pastedImages";

const AgentMarkdown = lazy(() =>
  import("../AgentMarkdown/AgentMarkdown").then((module) => ({ default: module.AgentMarkdown })),
);
import { AgentThoughtBlock } from "../AgentThoughtBlock/AgentThoughtBlock";
import { PlanBlock } from "../PlanBlock/PlanBlock";
import { traceCoversSubagentSession } from "../../../../chatReducer";
import { SubagentBlock } from "../SubagentBlock/SubagentBlock";
import { ToolCallCompactBlock } from "../../tools/ToolCallCompactBlock/ToolCallCompactBlock";
import { ToolCallCompactExecuteBlock } from "../../tools/ToolCallCompactExecuteBlock/ToolCallCompactExecuteBlock";
import { isCompactGroupableTool, isSubagentTaskTool } from "../../../../toolCallCompactText";

function traceSegmentGapClass(
  previousType: TraceItem["type"] | undefined,
  currentType: TraceItem["type"],
): string {
  if (previousType === undefined) {
    return "";
  }
  if (isActivityTraceType(previousType) || isActivityTraceType(currentType)) {
    return "";
  }
  const isAgentResponse = (type: TraceItem["type"]) => type === "agent";
  if (isAgentResponse(previousType) === isAgentResponse(currentType)) {
    return "";
  }
  return " trace-segment-gap";
}

type TraceRenderSegment =
  | { kind: "single"; item: TraceItem; index: number }
  | { kind: "toolCompactSingle"; tool: TraceToolItem; index: number }
  | { kind: "toolExecute"; tool: TraceToolItem; index: number };

function partitionTraceSegments(
  items: readonly TraceItem[],
  showThoughts: boolean,
  subagentSessionByToolId: ReadonlyMap<string, string> | undefined,
): TraceRenderSegment[] {
  const segments: TraceRenderSegment[] = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index]!;
    if (item.type === "thought" && !showThoughts) {
      continue;
    }
    if (
      item.type === "subagent" &&
      subagentSessionByToolId !== undefined &&
      traceCoversSubagentSession(items, subagentSessionByToolId, item.sessionId)
    ) {
      continue;
    }
    if (item.type === "tool" && isSubagentTaskTool(item)) {
      segments.push({ kind: "single", item, index });
      continue;
    }
    if (item.type === "tool" && !isCompactGroupableTool(item)) {
      segments.push({ kind: "toolExecute", tool: item, index });
      continue;
    }
    if (item.type === "tool") {
      segments.push({ kind: "toolCompactSingle", tool: item, index });
      continue;
    }
    segments.push({ kind: "single", item, index });
  }
  return segments;
}

function traceRow(start: number, end: number, child: ReactElement): ReactElement {
  return (
    <div key={`${start}:${end}`} data-trace-index={start} data-trace-end={end}>
      {child}
    </div>
  );
}

function thoughtIndexes(items: readonly TraceItem[]): number[] {
  const indexes: number[] = [];
  for (let index = 0; index < items.length; index++) {
    if (items[index]?.type === "thought") {
      indexes.push(index);
    }
  }
  return indexes;
}

function traceRowElement(scrollEl: HTMLElement, index: number): HTMLElement | null {
  return scrollEl.querySelector<HTMLElement>(`[data-trace-index="${index}"]`);
}

function visibleTraceType(item: TraceItem, showThoughts: boolean): TraceItem["type"] | undefined {
  if (item.type === "thought" && !showThoughts) {
    return undefined;
  }
  return item.type;
}

type TraceSegmentViewProps = {
  segment: TraceRenderSegment;
  gapClass: string;
  expandAllToolOutputs: boolean;
  collapseNonce: number;
  onCollapseExpandAll?: () => void;
  onOpenWorkspacePath?: (path: string, options?: { target?: WorkspacePathOpenTarget }) => void;
  onOpenImage?: (src: string) => void;
  onOpenSubagent?: (sessionId: string) => void;
  onOpenTask?: (toolCallId: string) => void;
  taskActivity?: readonly TraceItem[];
};

function traceSegmentPropsAreEqual(prev: TraceSegmentViewProps, next: TraceSegmentViewProps): boolean {
  if (prev.gapClass !== next.gapClass || prev.expandAllToolOutputs !== next.expandAllToolOutputs) {
    return false;
  }
  if (prev.collapseNonce !== next.collapseNonce) {
    return false;
  }
  if (
    prev.onCollapseExpandAll !== next.onCollapseExpandAll ||
    prev.onOpenWorkspacePath !== next.onOpenWorkspacePath ||
    prev.onOpenImage !== next.onOpenImage ||
    prev.onOpenSubagent !== next.onOpenSubagent ||
    prev.onOpenTask !== next.onOpenTask ||
    prev.taskActivity !== next.taskActivity
  ) {
    return false;
  }
  const left = prev.segment;
  const right = next.segment;
  if (left.kind !== right.kind || left.index !== right.index) {
    return false;
  }
  if (left.kind === "single" && right.kind === "single") {
    return left.item === right.item;
  }
  if (left.kind !== "single" && right.kind !== "single") {
    return left.tool === right.tool;
  }
  return false;
}

const TraceSegmentView = memo(function TraceSegmentView({
  segment,
  gapClass,
  expandAllToolOutputs,
  collapseNonce,
  onCollapseExpandAll,
  onOpenWorkspacePath,
  onOpenImage,
  onOpenSubagent,
  onOpenTask,
  taskActivity,
}: TraceSegmentViewProps): ReactElement | null {
  if (segment.kind === "toolExecute") {
    return traceRow(
      segment.index,
      segment.index,
      <ToolCallCompactExecuteBlock
        className={gapClass.trim()}
        item={segment.tool}
        expandAllToolOutputs={expandAllToolOutputs}
        onCollapseExpandAll={onCollapseExpandAll}
      />,
    );
  }
  if (segment.kind === "toolCompactSingle") {
    return traceRow(
      segment.index,
      segment.index,
      <ToolCallCompactBlock
        className={gapClass.trim()}
        items={[segment.tool]}
        expandAllToolOutputs={expandAllToolOutputs}
        onCollapseExpandAll={onCollapseExpandAll}
        onOpenWorkspacePath={onOpenWorkspacePath}
        onOpenImage={onOpenImage}
      />,
    );
  }
  const item = segment.item;
  if (item.type === "user") {
    return traceRow(
      segment.index,
      segment.index,
      <section className={`user-prompt-bar${gapClass}`} aria-label="User message">
        {item.images !== undefined && item.images.length > 0 ? (
          <div className="user-prompt-image-row" role="list" aria-label="Attached images">
            {item.images.map((image, imageIndex) => {
              const src = promptImageSrc(image);
              return (
                <button
                  key={`${imageIndex}:${image.mimeType}:${image.data.length}`}
                  type="button"
                  className="user-prompt-image"
                  role="listitem"
                  aria-label={`View image ${imageIndex + 1}`}
                  onClick={() => onOpenImage?.(src)}
                >
                  <img className="user-prompt-image-thumb" src={src} alt="" />
                </button>
              );
            })}
          </div>
        ) : item.imageCount !== undefined && item.imageCount > 0 ? (
          <span className="user-prompt-images" role="presentation">
            {item.imageCount === 1 ? "1 image" : `${item.imageCount} images`}
          </span>
        ) : null}
        <Suspense fallback={<div className="agent-markdown-pending">{item.text}</div>}>
          <AgentMarkdown text={item.text} />
        </Suspense>
      </section>,
    );
  }
  if (item.type === "agent") {
    return traceRow(
      segment.index,
      segment.index,
      <div className={`agent-response-stream${gapClass}`}>
        <div className="agent-response-markdown" aria-label="Agent response">
          <Suspense fallback={<div className="agent-markdown-pending">{item.text}</div>}>
            <AgentMarkdown text={item.text} />
          </Suspense>
        </div>
      </div>,
    );
  }
  if (item.type === "thought") {
    return traceRow(
      segment.index,
      segment.index,
      <AgentThoughtBlock
        className={gapClass.trim()}
        text={item.text}
        durationMs={item.durationMs}
        startedAtMs={item.startedAtMs}
        collapseNonce={collapseNonce}
      />,
    );
  }
  if (item.type === "tool") {
    return traceRow(
      segment.index,
      segment.index,
      isSubagentTaskTool(item) ? (
        <SubagentBlock
          className={gapClass.trim()}
          tool={item}
          onOpen={onOpenTask === undefined ? undefined : () => onOpenTask(item.toolCallId)}
          activity={taskActivity}
        />
      ) : (
        <ToolCallCompactBlock
          className={gapClass.trim()}
          items={[item]}
          expandAllToolOutputs={expandAllToolOutputs}
          onCollapseExpandAll={onCollapseExpandAll}
          onOpenWorkspacePath={onOpenWorkspacePath}
          onOpenImage={onOpenImage}
        />
      ),
    );
  }
  if (item.type === "subagent") {
    return traceRow(
      segment.index,
      segment.index,
      <SubagentBlock
        className={gapClass.trim()}
        session={item}
        onOpen={onOpenSubagent === undefined ? undefined : () => onOpenSubagent(item.sessionId)}
      />,
    );
  }
  if (item.type !== "plan") {
    return null;
  }
  return traceRow(
    segment.index,
    segment.index,
    <PlanBlock className={gapClass.trim()} entries={item.entries} />,
  );
}, traceSegmentPropsAreEqual);

/**
 * Renders the conversation trace: user lines, streamed agent markdown, tool blocks, and plan blocks.
 */
export const TraceList = memo(function TraceList({
  items,
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
  subagentSessionByToolId,
}: {
  items: readonly TraceItem[];
  showThoughts: boolean;
  expandAllToolOutputs: boolean;
  /** True when the transcript is following the latest text. */
  followBottom: boolean;
  /** Changes when a saved transcript replaces the visible trace. */
  historyCommit: number;
  traceScrollRef: RefObject<HTMLElement | null>;
  onCollapseExpandAll?: () => void;
  onOpenWorkspacePath?: (path: string, options?: { target?: WorkspacePathOpenTarget }) => void;
  onOpenImage?: (src: string) => void;
  onOpenSubagent?: (sessionId: string) => void;
  onOpenTask?: (toolCallId: string) => void;
  taskActivityByToolId?: ReadonlyMap<string, readonly TraceItem[]>;
  subagentSessionByToolId?: ReadonlyMap<string, string>;
}): ReactElement {
  const thoughtIndexesRef = useRef<number[] | null>(null);
  const seenHistoryCommitRef = useRef(historyCommit);
  const pendingScrollAdjustRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const [collapseNonceByIndex, setCollapseNonceByIndex] = useState<ReadonlyMap<number, number>>(
    () => new Map(),
  );

  if (seenHistoryCommitRef.current !== historyCommit) {
    seenHistoryCommitRef.current = historyCommit;
    thoughtIndexesRef.current = null;
    if (collapseNonceByIndex.size > 0) {
      setCollapseNonceByIndex(new Map());
    }
  }

  useLayoutEffect(() => {
    const next = thoughtIndexes(items);
    const previous = thoughtIndexesRef.current;
    thoughtIndexesRef.current = next;
    if (previous === null || previous.length === 0) {
      return;
    }
    const prior = previous[previous.length - 1]!;
    const scrollEl = traceScrollRef.current;
    const row = scrollEl === null ? null : traceRowElement(scrollEl, prior);
    const rowRect = row?.getBoundingClientRect();
    const portRect = scrollEl?.getBoundingClientRect();
    const previousThoughtInView =
      rowRect !== undefined && portRect !== undefined
        ? rectIntersectsScrollport(rowRect, portRect)
        : false;
    const index = previousThoughtIndexToCollapse({
      previousThoughtIndexes: previous,
      nextThoughtIndexes: next,
      followBottom,
      previousThoughtInView,
    });
    if (index === undefined) {
      return;
    }
    if (
      !followBottom &&
      scrollEl !== null &&
      rowRect !== undefined &&
      portRect !== undefined &&
      rectIsFullyAboveScrollport(rowRect, portRect)
    ) {
      pendingScrollAdjustRef.current = {
        scrollHeight: scrollEl.scrollHeight,
        scrollTop: scrollEl.scrollTop,
      };
    }
    setCollapseNonceByIndex((current) => {
      const nextMap = new Map(current);
      nextMap.set(index, (current.get(index) ?? 0) + 1);
      return nextMap;
    });
  }, [items, followBottom, historyCommit, traceScrollRef]);

  useLayoutEffect(() => {
    const pending = pendingScrollAdjustRef.current;
    if (pending === null) {
      return;
    }
    pendingScrollAdjustRef.current = null;
    const scrollEl = traceScrollRef.current;
    if (scrollEl === null) {
      return;
    }
    const shrunk = pending.scrollHeight - scrollEl.scrollHeight;
    if (shrunk > 0) {
      scrollEl.scrollTop = Math.max(0, pending.scrollTop - shrunk);
    }
  }, [collapseNonceByIndex, traceScrollRef]);

  const segments = partitionTraceSegments(items, showThoughts, subagentSessionByToolId);
  let previousVisibleType: TraceItem["type"] | undefined;

  const renderSegment = (segment: TraceRenderSegment): ReactElement | null => {
    const currentType =
      segment.kind === "single" ? visibleTraceType(segment.item, showThoughts) : "tool";
    if (currentType === undefined) {
      return null;
    }
    const gapClass = traceSegmentGapClass(previousVisibleType, currentType);
    previousVisibleType = currentType;
    return (
      <TraceSegmentView
        key={segment.index}
        segment={segment}
        gapClass={gapClass}
        expandAllToolOutputs={expandAllToolOutputs}
        collapseNonce={collapseNonceByIndex.get(segment.index) ?? 0}
        onCollapseExpandAll={onCollapseExpandAll}
        onOpenWorkspacePath={onOpenWorkspacePath}
        onOpenImage={onOpenImage}
        onOpenSubagent={onOpenSubagent}
        onOpenTask={onOpenTask}
        taskActivity={
          segment.kind === "single" && segment.item.type === "tool"
            ? taskActivityByToolId?.get(segment.item.toolCallId)
            : undefined
        }
      />
    );
  };

  const groupByStart = new Map(
    activityGroupRanges(segments.map((segment) => segmentTraceType(segment))).map((range) => [
      range.start,
      range,
    ]),
  );
  const rows: ReactElement[] = [];
  let segmentIndex = 0;
  while (segmentIndex < segments.length) {
    const range = groupByStart.get(segmentIndex);
    if (range === undefined) {
      const row = renderSegment(segments[segmentIndex]!);
      if (row !== null) {
        rows.push(row);
      }
      segmentIndex += 1;
      continue;
    }
    const children: ReactElement[] = [];
    for (let cursor = range.start; cursor <= range.end; cursor++) {
      const row = renderSegment(segments[cursor]!);
      if (row !== null) {
        children.push(row);
      }
    }
    rows.push(
      <div key={`activity-${range.start}`} className="trace-activity-group">
        {children}
      </div>,
    );
    segmentIndex = range.end + 1;
  }

  return <>{rows}</>;
});

function segmentTraceType(segment: TraceRenderSegment): TraceItem["type"] {
  if (segment.kind === "single") {
    return segment.item.type;
  }
  return "tool";
}
