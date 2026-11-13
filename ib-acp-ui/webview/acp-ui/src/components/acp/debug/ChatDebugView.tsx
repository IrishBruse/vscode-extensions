import { useMemo, useState, type CSSProperties, type ReactElement } from "react";
import type { TraceItem } from "../../../chatReducer";
import {
  buildChatDebug,
  chatDebugKindColor,
  chatDebugMixGradient,
  chatDebugShare,
  type ChatDebugCall,
  type ChatDebugNode,
} from "../../../chatDebugModel";
import "./ChatDebugView.css";

export type ChatDebugViewProps = {
  trace: readonly TraceItem[];
  title: string;
  agentName?: string;
  childTraces?: ReadonlyMap<string, { trace: readonly TraceItem[] }>;
};

function ShareCircle({ calls }: { calls: readonly ChatDebugCall[] }): ReactElement | null {
  if (calls.length === 0) {
    return null;
  }
  const share = chatDebugShare(calls);
  return (
    <div className="chat-debug-share">
      <div
        className="chat-debug-donut"
        style={{ background: chatDebugMixGradient(calls) }}
        role="img"
        aria-label={share.map((part) => `${part.label} ${part.count}`).join(", ")}
      >
        <span className="chat-debug-donut-hole">{calls.length}</span>
      </div>
      <ul className="chat-debug-legend">
        {share.map((part) => (
          <li key={part.tone}>
            <i style={{ background: chatDebugKindColor[part.tone] }} />
            <span style={{ color: chatDebugKindColor[part.tone] }}>{part.label}</span>
            <b>{part.count}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CallList({ node }: { node: ChatDebugNode }): ReactElement {
  return (
    <ol className="chat-debug-calls">
      {node.calls.map((call, index) => (
        <li className="chat-debug-call" key={`${node.id}-${index}`}>
          <span className="chat-debug-call-n">{index + 1}</span>
          <span className="chat-debug-call-kind" style={{ color: chatDebugKindColor[call.tone] }}>
            {call.kind}
          </span>
          <span className="chat-debug-call-title">{call.title}</span>
          <span className="chat-debug-call-meta">{call.meta}</span>
        </li>
      ))}
    </ol>
  );
}

/** Large run view: a row of steps and the calls for the selected step. */
export function ChatDebugView({
  trace,
  title,
  agentName,
  childTraces,
}: ChatDebugViewProps): ReactElement {
  const model = useMemo(
    () => buildChatDebug(trace, title, childTraces),
    [trace, title, childTraces],
  );
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selected = model.nodes.find((node) => node.id === pickedId) ?? model.nodes.at(-1) ?? null;

  return (
    <div className={selected !== null ? "chat-debug chat-debug--split" : "chat-debug"}>
      <header className="chat-debug-hud">
        <p className="chat-debug-brand">{agentName?.trim() || "Chat"}</p>
        <h1>{model.title}</h1>
        <p className="chat-debug-sub">{model.request}</p>
        <div className="chat-debug-stats">
          {model.stats.map((stat) => (
            <div key={stat.label}>
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </header>
      {model.nodes.length === 0 ? (
        <p className="chat-debug-empty">No messages yet.</p>
      ) : (
        <div className="chat-debug-lane" role="list">
          {model.nodes.map((node) => {
            const on = selected?.id === node.id;
            return (
              <button
                key={node.id}
                type="button"
                role="listitem"
                className={on ? `chat-debug-node tone-${node.tone} on` : `chat-debug-node tone-${node.tone}`}
                aria-pressed={on}
                title={node.title}
                style={{ "--node": node.color } as CSSProperties}
                onClick={() => {
                  setPickedId(node.id);
                }}
              >
                <span
                  className="chat-debug-ring"
                  style={{ background: chatDebugMixGradient(node.calls) }}
                >
                  <span className="chat-debug-shape">
                    {node.tone === "orch" || node.calls.length === 0 ? null : node.calls.length}
                  </span>
                </span>
                <span className="chat-debug-node-label">{node.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {selected !== null ? (
        <aside
          className={`chat-debug-panel tone-${selected.tone}`}
          style={{ "--node": selected.color } as CSSProperties}
        >
          <div className="chat-debug-panel-head">
            <div>
              <p className="chat-debug-kicker">{selected.kicker}</p>
              <h2>{selected.title}</h2>
            </div>
            <ShareCircle calls={selected.calls} />
          </div>
          <CallList node={selected} />
        </aside>
      ) : null}
    </div>
  );
}
