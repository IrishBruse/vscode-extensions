import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { splitMarkdownFileUris } from "../../../../../../../src/platform/fileUriPath";
import { splitHttpUrls } from "../../../../../../../src/platform/httpUrlText";
import type { WorkspacePathOpenTarget } from "../../../../../../../src/protocol/extensionHostMessages";
import "../ToolCallBlock/ToolCallBlock.css";
import "./ToolCallCompactBlock.css";
import {
  previewDiffRows,
  windowToolCallDiffRows,
} from "../../../../../../../src/acp/mapping/toolCallDiffLines";
import type { AcpUiPromptImage } from "../../../../../../../src/protocol/extensionHostMessages";
import type { TraceToolItem } from "../../../../chatReducer";
import { promptImageSrc } from "../../../../pastedImages";
import {
  type CompactToolDetailParts,
  compactGroupHiddenDetailCount,
  compactToolDetailParts,
  compactToolGroupSummaryParts,
  compactToolShowsDiffStats,
  isConfirmedFileDeletion,
  diffLineStats,
  toolCallDetailKind,
} from "../../../../toolCallCompactText";

export type OpenWorkspacePathOptions = {
  target?: WorkspacePathOpenTarget;
};

type OpenExternalUrl = (url: string) => void;

function toolPreviewSpans(
  text: string,
): Array<
  | { kind: "text"; text: string }
  | { kind: "file"; text: string; path: string }
  | { kind: "url"; text: string; url: string }
> {
  const spans: Array<
    | { kind: "text"; text: string }
    | { kind: "file"; text: string; path: string }
    | { kind: "url"; text: string; url: string }
  > = [];
  for (const span of splitMarkdownFileUris(text)) {
    if (span.kind === "file") {
      spans.push(span);
      continue;
    }
    spans.push(...splitHttpUrls(span.text));
  }
  return spans;
}

const pathTooltipDelayMs = 500;
const pathTooltipInstantWindowMs = 200;
let lastPathTooltipHideAt = 0;

function openPathClick(
  event: MouseEvent<HTMLAnchorElement>,
  openPath: string,
  openTarget: "auto" | undefined,
  onOpenWorkspacePath: ((path: string, options?: OpenWorkspacePathOptions) => void) | undefined,
): void {
  event.preventDefault();
  onOpenWorkspacePath?.(openPath, openTarget === "auto" ? { target: "auto" } : undefined);
}

function CompactPathLink({
  segment,
  onOpenWorkspacePath,
}: {
  segment: NonNullable<CompactToolDetailParts["pathSegment"]>;
  onOpenWorkspacePath: ((path: string, options?: OpenWorkspacePathOptions) => void) | undefined;
}): ReactElement {
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const hide = (): void => {
    clearTimer();
    if (openRef.current) {
      lastPathTooltipHideAt = Date.now();
    }
    openRef.current = false;
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      clearTimer();
      if (openRef.current) {
        lastPathTooltipHideAt = Date.now();
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onScroll = (): void => {
      hide();
    };
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const link = linkRef.current;
    const tip = tipRef.current;
    if (link === null || tip === null) {
      return;
    }
    const anchor = link.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const gap = 4;
    let top = anchor.bottom + gap;
    if (top + box.height > window.innerHeight - 4) {
      top = Math.max(4, anchor.top - gap - box.height);
    }
    let left = anchor.left + anchor.width / 2 - box.width / 2;
    left = Math.min(Math.max(4, left), Math.max(4, window.innerWidth - box.width - 4));
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
    tip.style.visibility = "visible";
  }, [open]);

  const arm = (): void => {
    clearTimer();
    const elapsed = Date.now() - lastPathTooltipHideAt;
    const delay = elapsed < pathTooltipInstantWindowMs ? 0 : pathTooltipDelayMs;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const link = linkRef.current;
      if (link === null) {
        return;
      }
      const resting = link.matches(":hover") || document.activeElement === link;
      if (!resting) {
        return;
      }
      openRef.current = true;
      setOpen(true);
    }, delay);
  };

  return (
    <>
      <a
        ref={linkRef}
        className="tool-call-compact-path-link"
        href="#"
        onClick={(event) => {
          event.stopPropagation();
          openPathClick(event, segment.openPath, segment.openTarget, onOpenWorkspacePath);
        }}
        onMouseEnter={arm}
        onMouseLeave={hide}
        onFocus={arm}
        onBlur={hide}
      >
        {segment.label}
      </a>
      {open
        ? createPortal(
            <span ref={tipRef} className="acp-ui-hover-tooltip" role="tooltip">
              {segment.title}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

function CompactDetailText({
  parts,
  onOpenWorkspacePath,
  onOpenExternalUrl,
}: {
  parts: CompactToolDetailParts;
  onOpenWorkspacePath: ((path: string, options?: OpenWorkspacePathOptions) => void) | undefined;
  onOpenExternalUrl: OpenExternalUrl | undefined;
}): ReactElement {
  if (parts.url !== undefined) {
    const url = parts.url;
    return (
      <span className="tool-call-compact-detail-text">
        <a
          className="tool-call-compact-path-link"
          href={url}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenExternalUrl?.(url);
          }}
        >
          {parts.detail}
        </a>
      </span>
    );
  }
  const segment = parts.pathSegment;
  if (segment === undefined) {
    return <span className="tool-call-compact-detail-text">{parts.detail}</span>;
  }
  return (
    <span className="tool-call-compact-detail-text">
      {segment.prefix ?? null}
      <CompactPathLink segment={segment} onOpenWorkspacePath={onOpenWorkspacePath} />
      {segment.suffix ?? null}
    </span>
  );
}

function CompactVerbDetail({
  parts,
  onOpenWorkspacePath,
  onOpenExternalUrl,
}: {
  parts: CompactToolDetailParts;
  onOpenWorkspacePath: ((path: string, options?: OpenWorkspacePathOptions) => void) | undefined;
  onOpenExternalUrl: OpenExternalUrl | undefined;
}): ReactElement {
  return (
    <>
      <span className="tool-call-compact-verb">{parts.verb}</span>
      {parts.detail.length > 0 ? (
        <>
          {" "}
          <CompactDetailText
            parts={parts}
            onOpenWorkspacePath={onOpenWorkspacePath}
            onOpenExternalUrl={onOpenExternalUrl}
          />
        </>
      ) : null}
    </>
  );
}

function CompactEditLine({
  item,
  onOpenWorkspacePath,
  onOpenExternalUrl,
}: {
  item: TraceToolItem;
  onOpenWorkspacePath: ((path: string, options?: OpenWorkspacePathOptions) => void) | undefined;
  onOpenExternalUrl: OpenExternalUrl | undefined;
}): ReactElement {
  const parts = compactToolDetailParts(item);
  const { added, removed } = diffLineStats(item.diffRows);
  const showStats = !isConfirmedFileDeletion(item);
  return (
    <span className="tool-call-compact-edit">
      <span className="tool-call-compact-verb">{parts.verb}</span>
      {parts.detail.length > 0 ? (
        <>
          {" "}
          <CompactDetailText
            parts={parts}
            onOpenWorkspacePath={onOpenWorkspacePath}
            onOpenExternalUrl={onOpenExternalUrl}
          />
        </>
      ) : null}
      {showStats && added > 0 ? (
        <span className="tool-call-compact-stat tool-call-compact-stat--added"> +{added}</span>
      ) : null}
      {showStats && removed > 0 ? (
        <span className="tool-call-compact-stat tool-call-compact-stat--removed"> -{removed}</span>
      ) : null}
    </span>
  );
}

function CompactImagePreview({
  image,
  onOpenImage,
}: {
  image: AcpUiPromptImage;
  onOpenImage: ((src: string) => void) | undefined;
}): ReactElement {
  const src = promptImageSrc(image);
  return (
    <button
      type="button"
      className="tool-call-compact-image"
      aria-label="View image"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenImage?.(src);
      }}
    >
      <img src={src} alt="" />
    </button>
  );
}

function CompactDetailLine({
  item,
  onOpenWorkspacePath,
  onOpenExternalUrl,
  onOpenImage,
}: {
  item: TraceToolItem;
  onOpenWorkspacePath: ((path: string, options?: OpenWorkspacePathOptions) => void) | undefined;
  onOpenExternalUrl: OpenExternalUrl | undefined;
  onOpenImage: ((src: string) => void) | undefined;
}): ReactElement {
  if (item.image === undefined) {
    return compactToolShowsDiffStats(item) ? (
      <CompactEditLine
        item={item}
        onOpenWorkspacePath={onOpenWorkspacePath}
        onOpenExternalUrl={onOpenExternalUrl}
      />
    ) : (
      <CompactVerbDetail
        parts={compactToolDetailParts(item)}
        onOpenWorkspacePath={onOpenWorkspacePath}
        onOpenExternalUrl={onOpenExternalUrl}
      />
    );
  }
  const parts = compactToolDetailParts(item);
  const line = compactToolShowsDiffStats(item) ? (
    <CompactEditLine
      item={item}
      onOpenWorkspacePath={onOpenWorkspacePath}
      onOpenExternalUrl={onOpenExternalUrl}
    />
  ) : (
    <>
      <span className="tool-call-compact-verb">{parts.verb}</span>
      {parts.detail.length > 0 ? (
        <CompactDetailText
          parts={parts}
          onOpenWorkspacePath={onOpenWorkspacePath}
          onOpenExternalUrl={onOpenExternalUrl}
        />
      ) : null}
    </>
  );
  return (
    <div className="tool-call-compact-detail-with-image">
      {line}
      <CompactImagePreview image={item.image} onOpenImage={onOpenImage} />
    </div>
  );
}

function CompactGroupSummary({
  items,
  onOpenWorkspacePath,
  onOpenExternalUrl,
  onOpenImage,
}: {
  items: TraceToolItem[];
  onOpenWorkspacePath: ((path: string, options?: OpenWorkspacePathOptions) => void) | undefined;
  onOpenExternalUrl: OpenExternalUrl | undefined;
  onOpenImage: ((src: string) => void) | undefined;
}): ReactElement {
  const parts = compactToolGroupSummaryParts(items);
  if (parts === null) {
    return (
      <CompactDetailLine
        item={items[0]!}
        onOpenWorkspacePath={onOpenWorkspacePath}
        onOpenExternalUrl={onOpenExternalUrl}
        onOpenImage={onOpenImage}
      />
    );
  }
  return (
    <>
      <span className="tool-call-compact-summary-verbs">{parts.verbs}</span>
      <span className="tool-call-compact-summary-counts"> {parts.counts}</span>
    </>
  );
}

const diffPreviewRowCount = 6;

function CompactDiffLines({ item }: { item: TraceToolItem }): ReactElement | null {
  const rows = windowToolCallDiffRows(item.diffRows ?? []);
  if (rows.length === 0) {
    return null;
  }
  const shown =
    rows.length > diffPreviewRowCount ? previewDiffRows(rows, diffPreviewRowCount) : rows;
  return (
    <div className="tool-call-compact-diff">
      <div className="tool-call-diff" role="group" aria-label="File diff">
        {shown.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={
              row.kind === "removed"
                ? "tool-call-diff-line tool-call-diff-line--removed"
                : row.kind === "added"
                  ? "tool-call-diff-line tool-call-diff-line--added"
                  : "tool-call-diff-line tool-call-diff-line--context"
            }
          >
            <span className="tool-call-diff-line-number">{row.line ?? ""}</span>
            <span className="tool-call-diff-text">{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactToolEntry({
  item,
  expandAllToolOutputs,
  onCollapseExpandAll,
  onOpenWorkspacePath,
  onOpenExternalUrl,
  onOpenImage,
}: {
  item: TraceToolItem;
  expandAllToolOutputs: boolean;
  onCollapseExpandAll?: () => void;
  onOpenWorkspacePath: ((path: string, options?: OpenWorkspacePathOptions) => void) | undefined;
  onOpenExternalUrl: OpenExternalUrl | undefined;
  onOpenImage: ((src: string) => void) | undefined;
}): ReactElement {
  const detailKind = toolCallDetailKind(item);
  const [localExpanded, setLocalExpanded] = useState(false);
  const prevExpandAllRef = useRef(expandAllToolOutputs);
  useEffect(() => {
    if (prevExpandAllRef.current && !expandAllToolOutputs) {
      setLocalExpanded(false);
    }
    prevExpandAllRef.current = expandAllToolOutputs;
  }, [expandAllToolOutputs]);
  const expanded = expandAllToolOutputs || localExpanded;
  const toggle = (): void => {
    if (expanded) {
      setLocalExpanded(false);
      if (expandAllToolOutputs) {
        onCollapseExpandAll?.();
      }
    } else {
      setLocalExpanded(true);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  };
  const line = (
    <CompactDetailLine
      item={item}
      onOpenWorkspacePath={onOpenWorkspacePath}
      onOpenExternalUrl={onOpenExternalUrl}
      onOpenImage={onOpenImage}
    />
  );
  return (
    <>
      {detailKind === "expandable" ? (
        <div
          className="tool-call-compact-summary tool-call-compact-summary--expandable"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={toggle}
          onKeyDown={onKeyDown}
        >
          {line}
        </div>
      ) : (
        <div className="tool-call-compact-summary">{line}</div>
      )}
      {detailKind === "diff" ? <CompactDiffLines item={item} /> : null}
      {detailKind === "expandable" && expanded && (item.content?.trim().length ?? 0) > 0 ? (
        <pre className="tool-call-compact-preview">
          {toolPreviewSpans(item.content ?? "").map((span, index) =>
            span.kind === "text" ? (
              <span key={index}>{span.text}</span>
            ) : span.kind === "file" ? (
              <a
                key={index}
                className="tool-call-compact-path-link"
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onOpenWorkspacePath?.(span.path);
                }}
              >
                {span.text}
              </a>
            ) : (
              <a
                key={index}
                className="tool-call-compact-path-link"
                href={span.url}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onOpenExternalUrl?.(span.url);
                }}
              >
                {span.text}
              </a>
            ),
          )}
        </pre>
      ) : null}
    </>
  );
}

/**
 * Compact tool-call presentation: one summary line, optional per-tool detail lines.
 */
export function ToolCallCompactBlock({
  items,
  className,
  maxVisibleDetails,
  expandAllToolOutputs,
  onCollapseExpandAll,
  onOpenWorkspacePath,
  onOpenExternalUrl,
  onOpenImage,
}: {
  items: TraceToolItem[];
  className?: string;
  /** When set, grouped blocks show only the last N detail lines. */
  maxVisibleDetails?: number;
  expandAllToolOutputs?: boolean;
  onCollapseExpandAll?: () => void;
  onOpenWorkspacePath?: (path: string, options?: OpenWorkspacePathOptions) => void;
  onOpenExternalUrl?: OpenExternalUrl;
  onOpenImage?: (src: string) => void;
}): ReactElement {
  const expandAll = expandAllToolOutputs ?? false;
  const single = items.length === 1;
  const inProgress = items.some(
    (item) => item.status === "pending" || item.status === "in_progress",
  );
  const visibleItems =
    maxVisibleDetails === undefined || single ? items : items.slice(-maxVisibleDetails);
  const hiddenDetailCount =
    maxVisibleDetails === undefined || single
      ? 0
      : compactGroupHiddenDetailCount(items.length, maxVisibleDetails);
  const truncatedDetails = hiddenDetailCount > 0;

  return (
    <div
      className={
        className === undefined || className.length === 0
          ? truncatedDetails
            ? "tool-call-compact tool-call-compact--truncated-details"
            : "tool-call-compact"
          : truncatedDetails
            ? `tool-call-compact tool-call-compact--truncated-details ${className}`
            : `tool-call-compact ${className}`
      }
      data-status={inProgress ? "in_progress" : "completed"}
      role="status"
      aria-label="Tool use"
    >
      {single ? (
        <CompactToolEntry
          item={items[0]!}
          expandAllToolOutputs={expandAll}
          onCollapseExpandAll={onCollapseExpandAll}
          onOpenWorkspacePath={onOpenWorkspacePath}
          onOpenExternalUrl={onOpenExternalUrl}
          onOpenImage={onOpenImage}
        />
      ) : (
        <div className="tool-call-compact-summary">
          <CompactGroupSummary
            items={items}
            onOpenWorkspacePath={onOpenWorkspacePath}
            onOpenExternalUrl={onOpenExternalUrl}
            onOpenImage={onOpenImage}
          />
        </div>
      )}
      {!single ? (
        <ul className="tool-call-compact-details" aria-label="Tool details">
          {hiddenDetailCount > 0 ? (
            <li className="tool-call-compact-hidden-row" aria-hidden="true">
              ... {hiddenDetailCount} earlier items hidden
            </li>
          ) : null}
          {visibleItems.map((item) => (
            <li
              key={item.toolCallId}
              className="tool-call-compact-detail-row"
              data-tool-id={item.toolCallId}
              data-status={item.status}
            >
              <CompactToolEntry
                item={item}
                expandAllToolOutputs={expandAll}
                onCollapseExpandAll={onCollapseExpandAll}
                onOpenWorkspacePath={onOpenWorkspacePath}
                onOpenExternalUrl={onOpenExternalUrl}
                onOpenImage={onOpenImage}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
