import {
  lazy,
  Suspense,
  type ReactElement,
  type SyntheticEvent,
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
 * Renders a compact model-thought chunk with markdown body text.
 * The heading toggles the thought text.
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
  const [expanded, setExpanded] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const seenCollapseNonceRef = useRef(collapseNonce);

  useLayoutEffect(() => {
    if (!expanded) {
      return;
    }
    const body = bodyRef.current;
    if (body === null) {
      return;
    }
    body.scrollTop = body.scrollHeight;
  }, [expanded, text]);

  useLayoutEffect(() => {
    if (collapseNonce === seenCollapseNonceRef.current) {
      return;
    }
    seenCollapseNonceRef.current = collapseNonce;
    setExpanded(false);
  }, [collapseNonce]);

  const onToggle = (event: SyntheticEvent<HTMLDetailsElement>): void => {
    setExpanded(event.currentTarget.open);
  };

  return (
    <details
      className={
        className === undefined || className.length === 0
          ? "agent-thought-chunk"
          : `agent-thought-chunk ${className}`
      }
      open={expanded}
      onToggle={onToggle}
      aria-label="Agent thought"
    >
      <summary className="agent-thought-chunk-title">
        <span className="agent-thought-chunk-chevron" aria-hidden="true" />
        {durationLabel(liveDurationMs, ticking)}
      </summary>
      <div className="agent-thought-chunk-body" ref={bodyRef}>
        <Suspense fallback={<div className="agent-markdown-pending">{text}</div>}>
          <AgentMarkdown text={text} />
        </Suspense>
      </div>
    </details>
  );
}
