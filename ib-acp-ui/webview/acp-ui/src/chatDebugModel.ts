import { subagentTaskViewFromTool } from "../../../src/acp/mapping/taskToolPresentation";
import { formatCompactDurationMs } from "../../../src/protocol/visibleTrace";
import type { TraceItem } from "./chatReducer";

export type ChatDebugTone =
  | "request"
  | "read"
  | "edit"
  | "shell"
  | "search"
  | "glob"
  | "tool"
  | "subagent"
  | "plan"
  | "orch";

export type ChatDebugCall = {
  kind: string;
  tone: ChatDebugTone;
  title: string;
  meta: string;
};

/** Kind colors from the agent-trace page. */
export const chatDebugKindColor: Record<ChatDebugTone, string> = {
  read: "#4ca0f5",
  search: "#7c8cf8",
  shell: "#3fb950",
  edit: "#e3814b",
  glob: "#39c5cf",
  tool: "#f0f0f0",
  subagent: "#db61a2",
  plan: "#6e7681",
  request: "#d29922",
  orch: "#a371f7",
};

/** Subagent node colors, in the agent-trace cycle. */
const subagentCycle = [
  "#e3814b",
  "#4ca0f5",
  "#3fb950",
  "#39c5cf",
  "#c4622d",
  "#db61a2",
  "#e8a87c",
  "#56d364",
];

export type ChatDebugNode = {
  id: string;
  tone: ChatDebugTone;
  color: string;
  label: string;
  kicker: string;
  title: string;
  calls: ChatDebugCall[];
};

export type ChatDebugModel = {
  title: string;
  request: string;
  stats: { value: string; label: string }[];
  nodes: ChatDebugNode[];
};

const maxLineLength = 160;

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLineLength) {
    return flat;
  }
  return `${flat.slice(0, maxLineLength - 1)}…`;
}

function shortLabel(text: string): string {
  const line = oneLine(text);
  if (line.length <= 22) {
    return line.length > 0 ? line : "Request";
  }
  return `${line.slice(0, 21)}…`;
}

function toneForKind(kind: string | undefined): ChatDebugTone {
  if (kind === "execute" || kind === "terminal") {
    return "shell";
  }
  if (kind === "read") {
    return "read";
  }
  if (kind === "edit" || kind === "write" || kind === "delete") {
    return "edit";
  }
  if (kind === "search" || kind === "grep") {
    return "search";
  }
  if (kind === "glob") {
    return "glob";
  }
  return "tool";
}

function kindName(tone: ChatDebugTone): string {
  if (tone === "shell") {
    return "Shell";
  }
  if (tone === "read") {
    return "Read";
  }
  if (tone === "edit") {
    return "Edit";
  }
  if (tone === "search") {
    return "Search";
  }
  if (tone === "glob") {
    return "Glob";
  }
  if (tone === "subagent") {
    return "Subagent";
  }
  if (tone === "plan") {
    return "Plan";
  }
  if (tone === "orch") {
    return "Chat";
  }
  if (tone === "request") {
    return "Request";
  }
  return "Tool";
}

function callMeta(item: Extract<TraceItem, { type: "tool" }>): string {
  if (item.status === "failed") {
    return "Failed";
  }
  if (item.status === "in_progress") {
    return "Running";
  }
  if (item.status === "pending") {
    return "Waiting";
  }
  if (item.durationMs !== undefined) {
    return formatCompactDurationMs(item.durationMs);
  }
  return "";
}

function userText(item: Extract<TraceItem, { type: "user" }>): string {
  const text = oneLine(item.text);
  if (text.length > 0) {
    return text;
  }
  if ((item.imageCount ?? item.images?.length ?? 0) > 0) {
    return "Image";
  }
  return "";
}

function subagentStateLabel(state: Extract<TraceItem, { type: "subagent" }>["state"]): string {
  if (state === "running") {
    return "Running";
  }
  if (state === "idle") {
    return "Idle";
  }
  if (state === "requires_action") {
    return "Needs action";
  }
  if (state === "unknown") {
    return "Unknown";
  }
  return "";
}

export type ChatDebugShare = {
  tone: ChatDebugTone;
  label: string;
  count: number;
};

/** Tool-kind counts in palette order, for the share circle. */
export function chatDebugShare(calls: readonly ChatDebugCall[]): ChatDebugShare[] {
  const counts = new Map<ChatDebugTone, number>();
  for (const call of calls) {
    counts.set(call.tone, (counts.get(call.tone) ?? 0) + 1);
  }
  const order: ChatDebugTone[] = ["read", "search", "glob", "shell", "edit", "tool", "subagent", "plan"];
  return order
    .filter((tone) => (counts.get(tone) ?? 0) > 0)
    .map((tone) => ({ tone, label: kindName(tone), count: counts.get(tone) ?? 0 }));
}

/** Conic gradient for a tool-kind share circle. */
export function chatDebugMixGradient(calls: readonly ChatDebugCall[]): string {
  const share = chatDebugShare(calls);
  const total = calls.length;
  if (share.length === 0 || total === 0) {
    return chatDebugKindColor.tool;
  }
  let at = 0;
  const stops = share.map((part) => {
    const start = (at / total) * 100;
    at += part.count;
    const end = (at / total) * 100;
    return `${chatDebugKindColor[part.tone]} ${start}% ${end}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function toolCall(item: Extract<TraceItem, { type: "tool" }>): ChatDebugCall {
  const task = subagentTaskViewFromTool(item);
  if (task !== undefined) {
    const kind = task.subagentType.length > 0 ? task.subagentType : "Subagent";
    const detail = oneLine(task.prompt.length > 0 ? task.prompt : task.description);
    return { kind, tone: "subagent", title: detail, meta: callMeta(item) };
  }
  const tone = toneForKind(item.kind);
  return { kind: kindName(tone), tone, title: oneLine(item.title), meta: callMeta(item) };
}

function planCalls(item: Extract<TraceItem, { type: "plan" }>): ChatDebugCall[] {
  return item.entries.map((entry) => ({
    kind:
      entry.status === "completed"
        ? "Done"
        : entry.status === "in_progress"
          ? "Running"
          : entry.status === "pending"
            ? "Pending"
            : entry.status,
    tone: "plan" as const,
    title: oneLine(entry.content),
    meta: "",
  }));
}

function callsInTrace(items: readonly TraceItem[]): ChatDebugCall[] {
  const calls: ChatDebugCall[] = [];
  for (const item of items) {
    if (item.type === "tool") {
      calls.push(toolCall(item));
      continue;
    }
    if (item.type === "plan") {
      calls.push(...planCalls(item));
    }
  }
  return calls;
}

/** Builds the debug graph: the chat and each subagent are the steps. Tools stay inside a step. */
export function buildChatDebug(
  trace: readonly TraceItem[],
  title: string,
  childTraces?: ReadonlyMap<string, { trace: readonly TraceItem[] }>,
): ChatDebugModel {
  const nodes: ChatDebugNode[] = [];
  const chatCalls: ChatDebugCall[] = [];
  let toolCount = 0;
  let subagentCount = 0;
  let requestCount = 0;
  let latestRequest = "";

  const pushSubagent = (node: Omit<ChatDebugNode, "id" | "color">): void => {
    const color = subagentCycle[subagentCount % subagentCycle.length] ?? chatDebugKindColor.subagent;
    subagentCount += 1;
    nodes.push({ ...node, id: `node-${nodes.length}`, color });
  };

  for (const item of trace) {
    if (item.type === "user") {
      const text = userText(item);
      if (text.length === 0) {
        continue;
      }
      requestCount += 1;
      latestRequest = text;
      continue;
    }
    if (item.type === "tool") {
      const task = subagentTaskViewFromTool(item);
      if (task !== undefined) {
        const call = toolCall(item);
        pushSubagent({
          tone: "subagent",
          label: shortLabel(task.description),
          kicker: call.kind,
          title: oneLine(task.description),
          calls: [call],
        });
        continue;
      }
      const call = toolCall(item);
      toolCount += 1;
      chatCalls.push(call);
      continue;
    }
    if (item.type === "subagent") {
      const detail = oneLine(item.description);
      const childCalls = callsInTrace(childTraces?.get(item.sessionId)?.trace ?? []);
      pushSubagent({
        tone: "subagent",
        label: shortLabel(item.title),
        kicker: "Subagent",
        title: oneLine(item.title),
        calls:
          childCalls.length > 0
            ? childCalls
            : [
                {
                  kind: "Subagent",
                  tone: "subagent",
                  title: detail.length > 0 ? detail : oneLine(item.stopReason ?? item.title),
                  meta: subagentStateLabel(item.state),
                },
              ],
      });
      continue;
    }
    if (item.type === "plan") {
      chatCalls.push(...planCalls(item));
    }
  }

  if (chatCalls.length > 0) {
    nodes.unshift({
      id: "chat",
      tone: "orch",
      color: chatDebugKindColor.orch,
      label: "Chat",
      kicker: "Chat",
      title: toolCount === 1 ? "1 tool" : `${toolCount} tools`,
      calls: chatCalls,
    });
  }

  const stats = [
    { value: String(requestCount), label: "turns" },
    { value: String(toolCount), label: "tools" },
  ];
  if (subagentCount > 0) {
    stats.push({ value: String(subagentCount), label: "subagents" });
  }
  return {
    title: title.trim().length > 0 ? title.trim() : "Chat",
    request: latestRequest.length > 0 ? latestRequest : "No messages yet.",
    stats,
    nodes,
  };
}
