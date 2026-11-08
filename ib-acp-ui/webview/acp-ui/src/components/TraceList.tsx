import { lazy, Suspense, useLayoutEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import "./TraceList.css";
import type { ToolCallVerbosity } from "../../../../src/protocol/extensionHostMessages";
import type { WorkspacePathOpenTarget } from "../../../../src/protocol/extensionHostMessages";
import type { TraceItem, TraceToolItem } from "../chatReducer";
import {
  previousThoughtIndexToCollapse,
  rectIntersectsScrollport,
  rectIsFullyAboveScrollport,
} from "./thoughtCollapse";
import { activityGroupRanges, isActivityTraceType } from "./traceActivityGroup";
import { promptImageSrc } from "../pastedImages";

const AgentMarkdown = lazy(() =>
  import("./AgentMarkdown").then((module) => ({ default: module.AgentMarkdown })),
);
import { AgentThoughtBlock } from "./AgentThoughtBlock";
import { PlanBlock } from "./PlanBlock";
import { ToolCallBlock } from "./ToolCallBlock";
import { ToolCallCompactBlock } from "./ToolCallCompactBlock";
import { ToolCallCompactExecuteBlock } from "./ToolCallCompactExecuteBlock";
import { compactGroupMaxVisibleDetails, isCompactGroupableTool } from "../toolCallCompactText";

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
  | { kind: "toolGroup"; tools: TraceToolItem[]; index: number }
  | { kind: "toolCompactSingle"; tool: TraceToolItem; index: number }
  | { kind: "toolExecute"; tool: TraceToolItem; index: number };

function usesCompactToolPresentation(toolCallVerbosity: ToolCallVerbosity): boolean {
  return toolCallVerbosity === "minimal" || toolCallVerbosity === "compact";
}

function flushToolBuffer(
  segments: TraceRenderSegment[],
  toolBuffer: TraceToolItem[],
  groupStartIndex: number,
  toolCallVerbosity: ToolCallVerbosity,
): void {
  if (toolBuffer.length === 0) {
    return;
  }
  if (toolCallVerbosity === "minimal") {
    segments.push({
      kind: "toolGroup",
      tools: toolBuffer,
      index: groupStartIndex,
    });
  } else if (toolCallVerbosity === "compact") {
    for (let i = 0; i < toolBuffer.length; i++) {
      const tool = toolBuffer[i]!;
      segments.push({
        kind: "toolCompactSingle",
        tool,
        index: groupStartIndex + i,
      });
    }
  } else {
    for (let i = 0; i < toolBuffer.length; i++) {
      const tool = toolBuffer[i]!;
      segments.push({
        kind: "single",
        item: tool,
        index: groupStartIndex + i,
      });
    }
  }
}

function partitionTraceSegments(
  items: TraceItem[],
  showThoughts: boolean,
  toolCallVerbosity: ToolCallVerbosity,
): TraceRenderSegment[] {
  const segments: TraceRenderSegment[] = [];
  let toolBuffer: TraceToolItem[] = [];
  let groupStartIndex = -1;

  const flushTools = (): void => {
    flushToolBuffer(segments, toolBuffer, groupStartIndex, toolCallVerbosity);
    toolBuffer = [];
    groupStartIndex = -1;
  };

  for (let index = 0; index < items.length; index++) {
    const item = items[index]!;
    if (item.type === "thought" && !showThoughts) {
      continue;
    }
    if (item.type === "tool") {
      if (usesCompactToolPresentation(toolCallVerbosity) && !isCompactGroupableTool(item)) {
        flushTools();
        segments.push({ kind: "toolExecute", tool: item, index });
        continue;
      }
      if (toolCallVerbosity === "minimal") {
        if (toolBuffer.length === 0) {
          groupStartIndex = index;
        }
        toolBuffer.push(item);
        continue;
      }
      if (toolCallVerbosity === "compact") {
        flushTools();
        segments.push({ kind: "toolCompactSingle", tool: item, index });
        continue;
      }
      if (toolBuffer.length === 0) {
        groupStartIndex = index;
      }
      toolBuffer.push(item);
      continue;
    }
    flushTools();
    segments.push({ kind: "single", item, index });
  }
  flushTools();
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

/**
 * Renders the conversation trace: user lines, streamed agent markdown, tool blocks, and plan blocks.
 */
export function TraceList({
  items,
  showThoughts,
  expandAllToolOutputs,
  toolCallVerbosity,
  followBottom,
  historyCommit,
  traceScrollRef,
  onCollapseExpandAll,
  onOpenWorkspacePath,
  onOpenImage,
}: {
  items: TraceItem[];
  showThoughts: boolean;
  expandAllToolOutputs: boolean;
  toolCallVerbosity: ToolCallVerbosity;
  /** True when the transcript is following the latest text. */
  followBottom: boolean;
  /** Changes when a saved transcript replaces the visible trace. */
  historyCommit: number;
  traceScrollRef: RefObject<HTMLElement | null>;
  onCollapseExpandAll?: () => void;
  onOpenWorkspacePath?: (path: string, options?: { target?: WorkspacePathOpenTarget }) => void;
  onOpenImage?: (src: string) => void;
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

  const segments = partitionTraceSegments(items, showThoughts, toolCallVerbosity);
  let previousVisibleType: TraceItem["type"] | undefined;

  const renderSegment = (segment: TraceRenderSegment): ReactElement | null => {
        if (segment.kind === "toolExecute") {
          const gapClass = traceSegmentGapClass(previousVisibleType, "tool");
          previousVisibleType = "tool";
          return traceRow(
            segment.index,
            segment.index,
            <ToolCallCompactExecuteBlock
              key={segment.tool.toolCallId}
              className={gapClass.trim()}
              item={segment.tool}
              expandAllToolOutputs={expandAllToolOutputs}
              onCollapseExpandAll={onCollapseExpandAll}
            />,
          );
        }

        if (segment.kind === "toolCompactSingle") {
          const gapClass = traceSegmentGapClass(previousVisibleType, "tool");
          previousVisibleType = "tool";
          return traceRow(
            segment.index,
            segment.index,
            <ToolCallCompactBlock
              key={segment.tool.toolCallId}
              className={gapClass.trim()}
              items={[segment.tool]}
              onOpenWorkspacePath={onOpenWorkspacePath}
            />,
          );
        }

        if (segment.kind === "toolGroup") {
          const gapClass = traceSegmentGapClass(previousVisibleType, "tool");
          previousVisibleType = "tool";
          return traceRow(
            segment.index,
            segment.index + segment.tools.length - 1,
            <ToolCallCompactBlock
              key={segment.tools.map((tool) => tool.toolCallId).join(":")}
              className={gapClass.trim()}
              items={segment.tools}
              maxVisibleDetails={compactGroupMaxVisibleDetails}
              onOpenWorkspacePath={onOpenWorkspacePath}
            />,
          );
        }

        const item = segment.item;
        const currentType = visibleTraceType(item, showThoughts);
        if (currentType === undefined) {
          return null;
        }
        const gapClass = traceSegmentGapClass(previousVisibleType, currentType);
        previousVisibleType = currentType;

        if (item.type === "user") {
          return traceRow(
            segment.index,
            segment.index,
            <section
              key={segment.index}
              className={`user-prompt-bar${gapClass}`}
              aria-label="User message"
            >
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
            <div key={segment.index} className={`agent-response-stream${gapClass}`}>
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
              key={segment.index}
              className={gapClass.trim()}
              text={item.text}
              durationMs={item.durationMs}
              collapseNonce={collapseNonceByIndex.get(segment.index) ?? 0}
            />,
          );
        }
        if (item.type === "tool") {
          return traceRow(
            segment.index,
            segment.index,
            <ToolCallBlock
              key={item.toolCallId}
              className={gapClass.trim()}
              item={item}
              expandAllToolOutputs={expandAllToolOutputs}
              onCollapseExpandAll={onCollapseExpandAll}
            />,
          );
        }
        return traceRow(
          segment.index,
          segment.index,
          <PlanBlock key={segment.index} className={gapClass.trim()} entries={item.entries} />,
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
}

function segmentTraceType(segment: TraceRenderSegment): TraceItem["type"] {
  if (segment.kind === "single") {
    return segment.item.type;
  }
  return "tool";
}
