import {
  lazy,
  Suspense,
  type ReactElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { formatThoughtSeconds } from "../../../../../../../src/protocol/visibleTrace";
import "./AgentThoughtBlock.css";

const AgentMarkdown = lazy(() =>
  import("../AgentMarkdown/AgentMarkdown").then((module) => ({ default: module.AgentMarkdown })),
);

function durationLabel(durationMs: number | undefined, running: boolean): string {
  const verb = running ? "Thinking" : "Thought";
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) {
    return verb;
  }
  const seconds = formatThoughtSeconds(durationMs);
  return seconds.length > 0 ? `${verb} for ${seconds}` : verb;
}

/**
 * Renders a model-thought chunk.
 * The body always shows the latest three lines.
 * The heading opens the full text.
 */
export function AgentThoughtBlock({
  text,
  durationMs,
  startedAtMs,
  className,
  collapseNonce = 0,
}: {
  text: string;
  durationMs?: number;
  /** Epoch ms when this thought started. Present only while it is still running. */
  startedAtMs?: number;
  className?: string;
  /** Increments to close this block without a click. */
  collapseNonce?: number;
}): ReactElement {
  const ticking = durationMs === undefined && startedAtMs !== undefined;
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) {
      return;
    }
    const handle = window.setInterval(() => {
      setNowMs(Date.now());
    }, 100);
    return () => {
      window.clearInterval(handle);
    };
  }, [ticking]);
  const liveDurationMs =
    ticking && startedAtMs !== undefined ? Math.max(0, nowMs - startedAtMs) : durationMs;
  const [expanded, setExpanded] = useState(false);
  const seenCollapseNonceRef = useRef(collapseNonce);

  useLayoutEffect(() => {
    if (collapseNonce === seenCollapseNonceRef.current) {
      return;
    }
    seenCollapseNonceRef.current = collapseNonce;
    setExpanded(false);
  }, [collapseNonce]);

  const rootClass = [
    "agent-thought-chunk",
    expanded ? "agent-thought-chunk--open" : "",
    className ?? "",
  ]
    .filter((part) => part.length > 0)
    .join(" ");

  return (
    <div className={rootClass} aria-label="Agent thought">
      <button
        type="button"
        className="agent-thought-chunk-title"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((open) => !open);
        }}
      >
        <span className="agent-thought-chunk-chevron" aria-hidden="true" />
        {durationLabel(liveDurationMs, ticking)}
      </button>
      <div className="agent-thought-chunk-body">
        <Suspense fallback={<div className="agent-markdown-pending">{text}</div>}>
          <AgentMarkdown text={text} />
        </Suspense>
      </div>
    </div>
  );
}
