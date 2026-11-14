import type { AcpUiSessionModelSelection } from "../../../src/acp/session/sessionModels";
import {
  modelConfigOption,
  modelParamCacheKey,
  resolvedModelParamOptionsForModelPick,
  type AcpUiSessionConfigOption,
} from "../../../src/acp/session/sessionConfigOptions";
import {
  cacheModelParamOptionsFromSession,
  readCachedModelParamOptions,
  writeCachedSessionConfigOptions,
  writeCachedSessionModels,
} from "../../../src/acp/session/sessionConfigOptionsCache";
import {
  canonicalToolCallId,
  resolveToolIndexByCallId,
} from "../../../src/acp/mapping/canonicalToolCallId";
import { subagentTaskViewFromTool } from "../../../src/acp/mapping/taskToolPresentation";
import type {
    AcpUiPromptImage,
    AcpUiRecentSession,
    ExtensionToWebviewMessage,
    AcpUiSlashCommand,
    PlanEntry,
    SubagentActivityEvent,
    SubagentWorkState,
    ToolCallDiffRow,
    ToolCallStatus,
} from "../../../src/protocol/extensionHostMessages";
import {
  normalizeBashDurations,
  normalizeThoughtDurations,
  positiveDurationMs,
  type AcpUiBashDuration,
  type AcpUiVisibleTraceItem,
} from "../../../src/protocol/visibleTrace";
import type { AcpUiTokenUsage } from "./tokenUsage";

export type InitPayload = Extract<ExtensionToWebviewMessage, { type: "init" }>;
export type ExtensionMessageAfterInit = Exclude<ExtensionToWebviewMessage, { type: "init" }>;

export type TraceToolItem = {
  type: "tool";
  toolCallId: string;
  title: string;
  kind: string | undefined;
  /** Dim terminal-style line (paths, args, preview); from ACP at tool start. */
  subtitle: string | undefined;
  /** Working directory for a bash tool. */
  cwd?: string;
  status: ToolCallStatus;
  content: string | undefined;
  /** Structured diff when the agent sent `diff` content (preferred over plain `content`). */
  diffRows: ToolCallDiffRow[] | undefined;
  /** Image the agent read. Shown as a small preview on the tool row. */
  image?: AcpUiPromptImage;
  detailVisible: boolean;
  durationMs?: number;
  /** Epoch ms while a bash command or subagent is still running. */
  startedAtMs?: number;
  /** Set when a linked subagent stops for a reason other than a normal end. */
  taskStopReason?: string;
};

export type SubagentTraceItem = {
  type: "subagent";
  sessionId: string;
  title: string;
  description: string;
  state: SubagentWorkState | null;
  stopReason: string | null;
  /** Epoch ms while this child is running. */
  startedAtMs?: number;
};

export type TraceItem =
  | { type: "user"; text: string; imageCount?: number; images?: AcpUiPromptImage[] }
  | { type: "thought"; text: string; durationMs?: number; startedAtMs?: number }
  | { type: "agent"; text: string }
  | TraceToolItem
  | { type: "plan"; entries: PlanEntry[] }
  | SubagentTraceItem;

export type SubagentActivity = {
  trace: TraceItem[];
  toolIndexById: Map<string, number>;
  openStreamIndex: number | null;
};

export type AcpAgentSelectionState = {
  currentName: string;
};

export type PermissionPromptState = {
  requestId: string;
  toolTitle: string;
  detail?: string;
  summary?: string;
  diffRows?: ToolCallDiffRow[];
  options: { optionId: string; name: string }[];
};

export type AskQuestionPromptState = Extract<
  ExtensionToWebviewMessage,
  { type: "cursorAskQuestionRequest" }
>;

export type CreatePlanPromptState = Extract<
  ExtensionToWebviewMessage,
  { type: "cursorCreatePlanRequest" }
>;

export type ChatState = {
  trace: TraceItem[];
  openStreamIndex: number | null;
  toolIndexById: Map<string, number>;
  promptInFlight: boolean;
  errorText: string | null;
  /** Whether the ACP agent subprocess is connected for this chat. */
  agentConnected: boolean;
  modelSelection: AcpUiSessionModelSelection | null;
  sessionConfigOptions: AcpUiSessionConfigOption[] | null;
  /** True while waiting for agent model/config options (uncached reconnect). */
  sessionConfigLoading: boolean;
  /** True while ACP `session/load` is replaying conversation history. */
  sessionHistoryLoading: boolean;
  viewportCacheActive: boolean;
  replayTrace: TraceItem[];
  replayToolIndexById: Map<string, number>;
  replayOpenStreamIndex: number | null;
  replayThoughtStartedAtMs: number | null;
  replayToolStartedAtMsById: Map<string, number>;
  historyCommit: number;
  /** Increments when the on-screen trace should be persisted to the session file cache. */
  visibleTraceCacheEpoch: number;
  /** Client-measured thought times for the whole chat, in thought order. Zero means unknown. */
  thoughtDurations: number[];
  /** Client-measured bash elapsed times for the whole chat, keyed by tool call id. */
  bashDurations: AcpUiBashDuration[];
  /** Live transcript for each child subagent, keyed by child session id. */
  subagentActivity: Map<string, SubagentActivity>;
  /** Child session id for a Cursor task tool, keyed by tool call id. */
  subagentSessionByToolId: Map<string, string>;
  acpAgentSelection: AcpAgentSelectionState | null;
  /** Configured ACP agent (provider) names for the empty-chat provider select. */
  providers: string[];
  /** Recent chats for the current agent, newest first (empty-chat recents). */
  recentSessions: AcpUiRecentSession[];
  /** Chat title from the `.acp` file. */
  sessionTitle: string;
  slashCommands: AcpUiSlashCommand[];
  permissionPrompt: PermissionPromptState | null;
  askQuestionPrompt: AskQuestionPromptState | null;
  createPlanPrompt: CreatePlanPromptState | null;
  /**
   * From host init: agent was fixed when the chat was created (VS Code sidebar flow).
   */
  lockSessionAgent: boolean;
  /**
   * After the first real user message, model + agent pickers are read-only (playground pre-flight).
   */
  composerPicksLocked: boolean;
  /** When true, hide model/config controls in the composer footer. */
  hideComposerModelControls: boolean;
  thoughtStartedAtMs: number | null;
  /** Client clock start for tool rows waiting on a completed/failed status. */
  toolStartedAtMsById: Map<string, number>;
  /** Whether the agent advertises image prompts; null before the agent connects. */
  promptImageSupported: boolean | null;
  /** Context window usage from the agent; null until the first `usage_update`. */
  tokenUsage: AcpUiTokenUsage | null;
};

export type ChatAction =
  | ExtensionMessageAfterInit
  | { type: "submit"; body: string; imageCount?: number; images?: AcpUiPromptImage[] }
  | { type: "pickSessionModel"; modelId: string }
  | { type: "pickSessionAgent"; agentName: string }
  | {
      type: "pickSessionConfigOption";
      configId: string;
      value: string | boolean;
    }
  | { type: "clearPermissionPrompt" }
  | { type: "clearAskQuestionPrompt" }
  | { type: "clearCreatePlanPrompt" }
  | { type: "stopTurn" };

const EDIT_TOOL_DISPLAY_TITLE = "Write File";

/** Stable header for ACP `kind: edit` tools (file write / diff), ignoring verbose agent titles. */
function toolDisplayTitle(kind: string | undefined, agentTitle: string): string {
  if (kind !== undefined && kind.toLowerCase() === "edit") {
    return EDIT_TOOL_DISPLAY_TITLE;
  }
  const t = agentTitle.trim();
  return t.length > 0 ? t : "Tool";
}

function modelSelectionFromConfigOptions(
  options: AcpUiSessionConfigOption[],
): AcpUiSessionModelSelection | null {
  const modelOption = options.find(
    (option) => option.type === "select" && option.category === "model",
  );
  if (modelOption?.type !== "select") {
    return null;
  }
  return {
    currentModelId: modelOption.currentValue,
    availableModels: modelOption.options.map((choice) => ({
      modelId: choice.value,
      name: choice.name,
    })),
  };
}

function isModelConfigPick(
  options: ReadonlyArray<AcpUiSessionConfigOption>,
  configId: string,
): boolean {
  const option = options.find((row) => row.configId === configId);
  return option?.type === "select" && option.category === "model";
}

function agentNameFromState(state: ChatState): string {
  return state.acpAgentSelection?.currentName ?? "";
}

function applySessionConfigOptions(
  state: ChatState,
  options: AcpUiSessionConfigOption[],
): ChatState {
  const agentName = agentNameFromState(state);
  if (agentName.length > 0) {
    cacheModelParamOptionsFromSession(agentName, options);
    writeCachedSessionConfigOptions(agentName, options);
  }
  const modelSelection = modelSelectionFromConfigOptions(options);
  return {
    ...state,
    sessionConfigOptions: options,
    sessionConfigLoading: false,
    ...(modelSelection !== null ? { modelSelection } : {}),
  };
}

function applySessionConfigOptionsLoading(state: ChatState): ChatState {
  return {
    ...state,
    sessionConfigOptions: null,
    modelSelection: null,
    sessionConfigLoading: true,
  };
}

export function createInitialChatState(): ChatState {
  return {
    trace: [],
    openStreamIndex: null,
    toolIndexById: new Map(),
    promptInFlight: false,
    errorText: null,
    agentConnected: false,
    modelSelection: null,
    sessionConfigOptions: null,
    sessionConfigLoading: true,
    sessionHistoryLoading: false,
    viewportCacheActive: false,
    replayTrace: [],
    replayToolIndexById: new Map(),
    replayOpenStreamIndex: null,
    replayThoughtStartedAtMs: null,
    replayToolStartedAtMsById: new Map(),
    historyCommit: 0,
    visibleTraceCacheEpoch: 0,
    thoughtDurations: [],
    bashDurations: [],
    subagentActivity: new Map(),
    subagentSessionByToolId: new Map(),
    acpAgentSelection: null,
    providers: [],
    recentSessions: [],
    sessionTitle: "",
    slashCommands: [],
    permissionPrompt: null,
    askQuestionPrompt: null,
    createPlanPrompt: null,
    lockSessionAgent: false,
    composerPicksLocked: false,
    hideComposerModelControls: false,
    thoughtStartedAtMs: null,
    toolStartedAtMsById: new Map(),
    promptImageSupported: null,
    tokenUsage: null,
  };
}

function isTerminalToolStatus(status: ToolCallStatus): boolean {
  return status === "completed" || status === "failed";
}

function isBashToolKind(kind: string | undefined): boolean {
  const normalized = kind?.toLowerCase() ?? "";
  return normalized === "execute" || normalized === "terminal";
}

/** Start time of the newest bash tool that is still running. */
export function runningBashStartedAtMs(trace: readonly TraceItem[]): number | undefined {
  for (let index = trace.length - 1; index >= 0; index -= 1) {
    const item = trace[index];
    if (item === undefined || item.type !== "tool" || !isBashToolKind(item.kind)) {
      continue;
    }
    if (isTerminalToolStatus(item.status) || item.startedAtMs === undefined) {
      continue;
    }
    return item.startedAtMs;
  }
  return undefined;
}

function showsLiveRunClock(
  kind: string | undefined,
  title: string,
  subtitle: string | undefined,
  content: string | undefined,
): boolean {
  if (isBashToolKind(kind)) {
    return true;
  }
  return subagentTaskViewFromTool({ title, subtitle, content }) !== undefined;
}

function trackToolClock(
  toolStartedAtMsById: Map<string, number>,
  toolCallId: string,
  kind: string | undefined,
  title: string,
  subtitle: string | undefined,
  content: string | undefined,
  status: ToolCallStatus,
  knownStart: number | undefined,
  resolvedDuration: number | undefined,
): { toolStartedAtMsById: Map<string, number>; startedAtMs?: number } {
  if (resolvedDuration !== undefined || isTerminalToolStatus(status)) {
    return { toolStartedAtMsById: forgetToolStartedAt(toolStartedAtMsById, toolCallId) };
  }
  const startedAtMs = knownStart ?? Date.now();
  const next =
    knownStart === undefined
      ? rememberToolStartedAt(toolStartedAtMsById, toolCallId, startedAtMs)
      : toolStartedAtMsById;
  if (!showsLiveRunClock(kind, title, subtitle, content)) {
    return { toolStartedAtMsById: next };
  }
  return { toolStartedAtMsById: next, startedAtMs };
}

function rememberToolStartedAt(
  toolStartedAtMsById: Map<string, number>,
  toolCallId: string,
  startedAtMs: number,
): Map<string, number> {
  const next = new Map(toolStartedAtMsById);
  next.set(toolCallId, startedAtMs);
  const canonicalId = canonicalToolCallId(toolCallId);
  if (canonicalId !== toolCallId) {
    next.set(canonicalId, startedAtMs);
  }
  return next;
}

function forgetToolStartedAt(
  toolStartedAtMsById: Map<string, number>,
  toolCallId: string,
): Map<string, number> {
  if (!toolStartedAtMsById.has(toolCallId) && !toolStartedAtMsById.has(canonicalToolCallId(toolCallId))) {
    return toolStartedAtMsById;
  }
  const next = new Map(toolStartedAtMsById);
  next.delete(toolCallId);
  next.delete(canonicalToolCallId(toolCallId));
  return next;
}

function resolveToolStartedAtMs(
  toolStartedAtMsById: Map<string, number>,
  toolCallId: string,
): number | undefined {
  return toolStartedAtMsById.get(toolCallId) ?? toolStartedAtMsById.get(canonicalToolCallId(toolCallId));
}

function resolveToolDurationMs(
  provided: number | undefined,
  existing: number | undefined,
  startedAtMs: number | undefined,
  status: ToolCallStatus,
): number | undefined {
  const fromProvided = positiveDurationMs(provided);
  if (fromProvided !== undefined) {
    return fromProvided;
  }
  const fromExisting = positiveDurationMs(existing);
  if (fromExisting !== undefined) {
    return fromExisting;
  }
  if (!isTerminalToolStatus(status) || startedAtMs === undefined) {
    return undefined;
  }
  return positiveDurationMs(Date.now() - startedAtMs);
}

function finalizeOpenThoughtDuration(state: ChatState): ChatState {
  const now = Date.now();
  let changed = false;
  const trace = state.trace.map((item): TraceItem => {
    if (
      item.type !== "thought" ||
      item.durationMs !== undefined ||
      item.startedAtMs === undefined
    ) {
      return item;
    }
    changed = true;
    const durationMs = now - item.startedAtMs;
    if (!(durationMs > 0)) {
      return { type: "thought", text: item.text };
    }
    return { type: "thought", text: item.text, durationMs };
  });
  if (!changed) {
    return state.thoughtStartedAtMs === null ? state : { ...state, thoughtStartedAtMs: null };
  }
  return { ...state, trace, thoughtStartedAtMs: null };
}

type CachedThoughtTime = {
  text: string;
  durationMs?: number;
  startedAtMs?: number;
};

/** One duration per thought in `trace`. Zero means that thought has no saved time yet. */
export function thoughtDurationsFromTrace(trace: readonly TraceItem[]): number[] {
  const durations: number[] = [];
  for (const item of trace) {
    if (item.type !== "thought") {
      continue;
    }
    durations.push(positiveDurationMs(item.durationMs) ?? 0);
  }
  return normalizeThoughtDurations(durations);
}

/**
 * Keeps the longer list and prefers a positive time from `latest` on the shared tail.
 */
export function mergeThoughtDurationLists(
  stored: readonly number[],
  latest: readonly number[],
): number[] {
  if (latest.length === 0) {
    return stored.slice();
  }
  if (stored.length === 0) {
    return latest.slice();
  }
  const length = Math.max(stored.length, latest.length);
  const out: number[] = [];
  for (let index = 0; index < length; index += 1) {
    const latestIndex = index - (length - latest.length);
    const storedIndex = index - (length - stored.length);
    const fromLatest =
      latestIndex >= 0 ? positiveDurationMs(latest[latestIndex]) : undefined;
    const fromStored =
      storedIndex >= 0 ? positiveDurationMs(stored[storedIndex]) : undefined;
    out.push(fromLatest ?? fromStored ?? 0);
  }
  return normalizeThoughtDurations(out);
}

function thoughtIndexes(trace: readonly TraceItem[]): number[] {
  const indexes: number[] = [];
  for (let index = 0; index < trace.length; index += 1) {
    if (trace[index]?.type === "thought") {
      indexes.push(index);
    }
  }
  return indexes;
}

function thoughtWithCachedTime(item: TraceItem, cached: CachedThoughtTime): TraceItem {
  if (item.type !== "thought") {
    return item;
  }
  if (cached.durationMs !== undefined) {
    return { type: "thought", text: item.text, durationMs: cached.durationMs };
  }
  if (cached.startedAtMs !== undefined) {
    return { type: "thought", text: item.text, startedAtMs: cached.startedAtMs };
  }
  return item;
}

/**
 * Copies saved thought times onto the agent transcript.
 * The same thought text wins first. Remaining times align with the end of the transcript,
 * because the saved screen is the tail of the chat.
 */
export function mergeThoughtDurationsFromCache(
  authoritative: readonly TraceItem[],
  metadataSource: readonly TraceItem[],
): TraceItem[] {
  const cachedThoughts: CachedThoughtTime[] = [];
  for (const item of metadataSource) {
    if (item.type !== "thought") {
      continue;
    }
    const durationMs = positiveDurationMs(item.durationMs);
    const startedAtMs = positiveDurationMs(item.startedAtMs);
    cachedThoughts.push({
      text: item.text,
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(startedAtMs !== undefined ? { startedAtMs } : {}),
    });
  }
  if (!cachedThoughts.some((item) => item.durationMs !== undefined || item.startedAtMs !== undefined)) {
    return authoritative.slice();
  }
  const indexes = thoughtIndexes(authoritative);
  if (indexes.length === 0) {
    return authoritative.slice();
  }
  const next = authoritative.slice();
  const used = new Set<number>();
  const consumed = new Set<number>();
  for (let cacheIndex = cachedThoughts.length - 1; cacheIndex >= 0; cacheIndex -= 1) {
    const cached = cachedThoughts[cacheIndex];
    if (cached === undefined || (cached.durationMs === undefined && cached.startedAtMs === undefined)) {
      continue;
    }
    for (let thoughtPos = indexes.length - 1; thoughtPos >= 0; thoughtPos -= 1) {
      if (used.has(thoughtPos)) {
        continue;
      }
      const traceIndex = indexes[thoughtPos];
      const item = traceIndex === undefined ? undefined : next[traceIndex];
      if (item?.type !== "thought" || item.text !== cached.text) {
        continue;
      }
      used.add(thoughtPos);
      consumed.add(cacheIndex);
      next[traceIndex] = thoughtWithCachedTime(item, cached);
      break;
    }
  }
  const offset = indexes.length - cachedThoughts.length;
  for (let cacheIndex = 0; cacheIndex < cachedThoughts.length; cacheIndex += 1) {
    if (consumed.has(cacheIndex)) {
      continue;
    }
    const cached = cachedThoughts[cacheIndex];
    if (cached === undefined || (cached.durationMs === undefined && cached.startedAtMs === undefined)) {
      continue;
    }
    const thoughtPos = offset + cacheIndex;
    if (thoughtPos < 0 || thoughtPos >= indexes.length || used.has(thoughtPos)) {
      continue;
    }
    const traceIndex = indexes[thoughtPos];
    const item = traceIndex === undefined ? undefined : next[traceIndex];
    if (item === undefined) {
      continue;
    }
    used.add(thoughtPos);
    next[traceIndex] = thoughtWithCachedTime(item, cached);
  }
  return next;
}

/**
 * Copies a saved duration list onto thoughts, in order from the start.
 * When the replay has fewer thoughts, the later saved times are the ones that remain.
 * Zero does not clear a time already on the thought.
 */
export function applyThoughtDurationList(
  authoritative: readonly TraceItem[],
  durations: readonly number[],
): TraceItem[] {
  const saved = normalizeThoughtDurations(durations);
  if (saved.length === 0) {
    return authoritative.slice();
  }
  const indexes = thoughtIndexes(authoritative);
  if (indexes.length === 0) {
    return authoritative.slice();
  }
  const savedStart = saved.length > indexes.length ? saved.length - indexes.length : 0;
  const next = authoritative.slice();
  const count = Math.min(saved.length, indexes.length);
  for (let index = 0; index < count; index += 1) {
    const durationMs = positiveDurationMs(saved[savedStart + index]);
    if (durationMs === undefined) {
      continue;
    }
    const traceIndex = indexes[index];
    const item = traceIndex === undefined ? undefined : next[traceIndex];
    if (item?.type !== "thought") {
      continue;
    }
    next[traceIndex] = { type: "thought", text: item.text, durationMs };
  }
  return next;
}

/**
 * Copies UI-only tool metadata (durationMs) from a cached visible-trace onto
 * the authoritative agent-replay transcript by toolCallId.
 */
export function mergeToolDurationsFromCache(
  authoritative: readonly TraceItem[],
  metadataSource: readonly TraceItem[],
): TraceItem[] {
  const cachedById = new Map<string, number>();
  for (const item of metadataSource) {
    if (item.type !== "tool") {
      continue;
    }
    const durationMs = positiveDurationMs(item.durationMs);
    if (durationMs === undefined) {
      continue;
    }
    cachedById.set(canonicalToolCallId(item.toolCallId), durationMs);
  }
  if (cachedById.size === 0) {
    return authoritative.slice();
  }
  return authoritative.map((item) => {
    if (item.type !== "tool") {
      return item;
    }
    const cached = cachedById.get(canonicalToolCallId(item.toolCallId));
    const existing = positiveDurationMs(item.durationMs);
    const durationMs = isBashToolKind(item.kind) ? (cached ?? existing) : (existing ?? cached);
    if (durationMs === undefined || durationMs === item.durationMs) {
      return item;
    }
    return { ...item, durationMs };
  });
}

/** Saved bash elapsed times from the current trace, one row per command. */
export function bashDurationsFromTrace(trace: readonly TraceItem[]): AcpUiBashDuration[] {
  const rows: AcpUiBashDuration[] = [];
  for (const item of trace) {
    if (item.type !== "tool" || !isBashToolKind(item.kind)) {
      continue;
    }
    const durationMs = positiveDurationMs(item.durationMs);
    if (durationMs === undefined) {
      continue;
    }
    rows.push({ toolCallId: canonicalToolCallId(item.toolCallId), durationMs });
  }
  return normalizeBashDurations(rows);
}

/** Keeps every command id and prefers the time from `latest` when both lists have it. */
export function mergeBashDurationLists(
  stored: readonly AcpUiBashDuration[],
  latest: readonly AcpUiBashDuration[],
): AcpUiBashDuration[] {
  const byId = new Map<string, number>();
  for (const row of normalizeBashDurations(stored)) {
    byId.set(canonicalToolCallId(row.toolCallId), row.durationMs);
  }
  for (const row of normalizeBashDurations(latest)) {
    byId.set(canonicalToolCallId(row.toolCallId), row.durationMs);
  }
  return normalizeBashDurations(
    [...byId.entries()].map(([toolCallId, durationMs]) => ({ toolCallId, durationMs })),
  );
}

/**
 * Copies saved bash times onto the agent transcript by tool call id.
 * A saved time replaces a shorter clock measured while the transcript replays.
 */
export function applyBashDurations(
  authoritative: readonly TraceItem[],
  durations: readonly AcpUiBashDuration[],
): TraceItem[] {
  const saved = normalizeBashDurations(durations);
  if (saved.length === 0) {
    return authoritative.slice();
  }
  const byId = new Map(
    saved.map((row) => [canonicalToolCallId(row.toolCallId), row.durationMs] as const),
  );
  return authoritative.map((item) => {
    if (item.type !== "tool" || !isBashToolKind(item.kind)) {
      return item;
    }
    const durationMs = byId.get(canonicalToolCallId(item.toolCallId));
    if (durationMs === undefined || durationMs === item.durationMs) {
      return item;
    }
    return { ...item, durationMs };
  });
}

function stateAfterLeavingOpenThoughtStream(state: ChatState): ChatState {
  const open = state.openStreamIndex;
  if (open === null) {
    return state;
  }
  const existing = state.trace[open];
  if (existing?.type === "thought") {
    return finalizeOpenThoughtDuration(state);
  }
  return state;
}

/**
 * Builds initial chat state from the host `init` payload (model list from ACP or playground readme seed).
 */
function traceFromVisibleCache(items: readonly AcpUiVisibleTraceItem[] | undefined): {
  trace: TraceItem[];
  toolIndexById: Map<string, number>;
} {
  const trace: TraceItem[] = [];
  const toolIndexById = new Map<string, number>();
  for (const item of items ?? []) {
    if (item.type === "tool") {
      const hasDiff = item.diffRows !== undefined && item.diffRows.length > 0;
      const hasContent = item.content !== undefined && item.content.trim().length > 0;
      const durationMs = positiveDurationMs(item.durationMs);
      const startedAtMs = positiveDurationMs(item.startedAtMs);
      const tool: TraceToolItem = {
        type: "tool",
        toolCallId: item.toolCallId,
        title: item.title,
        kind: item.kind,
        subtitle: item.subtitle,
        ...(item.cwd !== undefined && item.cwd.length > 0 ? { cwd: item.cwd } : {}),
        status: item.status,
        content: item.content,
        diffRows: item.diffRows,
        ...(item.image !== undefined ? { image: item.image } : {}),
        detailVisible: item.detailVisible === true || hasDiff || hasContent,
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...(durationMs === undefined && startedAtMs !== undefined ? { startedAtMs } : {}),
      };
      toolIndexById.set(tool.toolCallId, trace.length);
      const canonicalId = canonicalToolCallId(tool.toolCallId);
      if (canonicalId !== tool.toolCallId) {
        toolIndexById.set(canonicalId, trace.length);
      }
      trace.push(tool);
      continue;
    }
    trace.push(item);
  }
  return { trace, toolIndexById };
}

function toolClocksFromTrace(trace: readonly TraceItem[]): Map<string, number> {
  let clocks = new Map<string, number>();
  for (const item of trace) {
    if (item.type !== "tool" || item.startedAtMs === undefined || isTerminalToolStatus(item.status)) {
      continue;
    }
    clocks = rememberToolStartedAt(clocks, item.toolCallId, item.startedAtMs);
  }
  return clocks;
}

function toolStatusIsLive(status: ToolCallStatus | undefined): boolean {
  return status === "pending" || status === "in_progress";
}

/** Freezes thoughts that were still open when the agent went idle. */
function settleOpenThoughts(trace: readonly TraceItem[], now = Date.now()): TraceItem[] {
  return trace.map((item) => {
    if (item.type !== "thought" || item.durationMs !== undefined || item.startedAtMs === undefined) {
      return item;
    }
    const durationMs = positiveDurationMs(now - item.startedAtMs);
    if (durationMs === undefined) {
      return { type: "thought", text: item.text };
    }
    return { type: "thought", text: item.text, durationMs };
  });
}

function thoughtClockFromTrace(trace: readonly TraceItem[]): number | null {
  const last = trace.at(-1);
  if (
    last?.type === "thought" &&
    last.durationMs === undefined &&
    last.startedAtMs !== undefined &&
    last.startedAtMs > 0
  ) {
    return last.startedAtMs;
  }
  return null;
}

export function createChatStateFromInit(payload: InitPayload): ChatState {
  const seeded = traceFromVisibleCache(payload.visibleTrace);
  const thoughtStartedAtMs = thoughtClockFromTrace(seeded.trace);
  const toolStartedAtMsById = toolClocksFromTrace(seeded.trace);
  const base: ChatState = {
    ...createInitialChatState(),
    trace: seeded.trace,
    toolIndexById: seeded.toolIndexById,
    thoughtStartedAtMs,
    toolStartedAtMsById,
    thoughtDurations: normalizeThoughtDurations(payload.thoughtDurations),
    bashDurations: normalizeBashDurations(payload.bashDurations),
    promptInFlight: thoughtStartedAtMs !== null || toolStartedAtMsById.size > 0,
    sessionHistoryLoading: payload.sessionHistoryLoading === true,
    viewportCacheActive: seeded.trace.length > 0 && payload.sessionHistoryLoading === true,
    acpAgentSelection: buildAcpAgentSelectionFromInit(payload),
    providers: payload.providers ?? [],
    recentSessions: payload.recentSessions ?? [],
    sessionTitle: payload.title.trim(),
    lockSessionAgent: payload.lockSessionAgent === true,
    composerPicksLocked: false,
    hideComposerModelControls: payload.hideComposerModelControls === true,
  };
  if (
    payload.sessionConfigOptionsSeed !== undefined &&
    payload.sessionConfigOptionsSeed.length > 0
  ) {
    return applySessionConfigOptions(base, payload.sessionConfigOptionsSeed);
  }
  const hasBootstrapModels =
    payload.sessionModels !== undefined && payload.sessionModels.availableModels.length > 0;
  return {
    ...base,
    modelSelection: payload.sessionModels ?? null,
    sessionConfigLoading: payload.hideComposerModelControls === true ? false : !hasBootstrapModels,
    sessionHistoryLoading: payload.sessionHistoryLoading === true,
  };
}

function buildAcpAgentSelectionFromInit(payload: InitPayload): AcpAgentSelectionState | null {
  const named = payload.acpAgentName;
  if (named !== undefined && named.length > 0) {
    return { currentName: named };
  }
  return null;
}

function userAttachmentFields(item: {
  imageCount?: number;
  images?: AcpUiPromptImage[];
}): { imageCount?: number; images?: AcpUiPromptImage[] } {
  return {
    ...(item.imageCount !== undefined ? { imageCount: item.imageCount } : {}),
    ...(item.images !== undefined && item.images.length > 0 ? { images: item.images } : {}),
  };
}

function appendUserText(state: ChatState, text: string): ChatState {
  const last = state.trace[state.trace.length - 1];
  if (last?.type === "user") {
    const trace = state.trace.slice();
    trace[trace.length - 1] = {
      type: "user",
      text: last.text + text,
      ...userAttachmentFields(last),
    };
    return { ...state, trace };
  }
  return {
    ...state,
    trace: [...state.trace, { type: "user" as const, text }],
  };
}

function appendUserImage(state: ChatState, image: AcpUiPromptImage): ChatState {
  const last = state.trace[state.trace.length - 1];
  if (last?.type === "user") {
    const images = last.images ?? [];
    const alreadyAttached = images.some(
      (existing) => existing.data === image.data && existing.mimeType === image.mimeType,
    );
    if (alreadyAttached) {
      return state;
    }
    const nextImages = [...images, image];
    const trace = state.trace.slice();
    trace[trace.length - 1] = {
      type: "user",
      text: last.text,
      imageCount: nextImages.length,
      images: nextImages,
    };
    return { ...state, trace };
  }
  return {
    ...state,
    trace: [
      ...state.trace,
      { type: "user", text: "", imageCount: 1, images: [image] },
    ],
  };
}

function appendAgentText(state: ChatState, text: string): ChatState {
  const open = state.openStreamIndex;
  if (open !== null) {
    const existing = state.trace[open];
    if (existing?.type === "agent") {
      const trace = state.trace.slice();
      trace[open] = { type: "agent", text: existing.text + text };
      return { ...state, trace };
    }
    if (existing?.type === "thought") {
      state = finalizeOpenThoughtDuration(state);
    }
  }
  const trace = [...state.trace, { type: "agent" as const, text }];
  return {
    ...state,
    trace,
    openStreamIndex: trace.length - 1,
  };
}

function appendAgentThought(
  state: ChatState,
  text: string,
  durationMs: number | undefined,
): ChatState {
  const resolvedDuration =
    durationMs !== undefined && durationMs > 0 ? durationMs : undefined;
  const open = state.openStreamIndex;
  if (open !== null) {
    const existing = state.trace[open];
    if (existing?.type === "thought") {
      const mergedDuration = resolvedDuration ?? existing.durationMs;
      const startedAtMs =
        mergedDuration !== undefined && mergedDuration > 0
          ? undefined
          : (existing.startedAtMs ?? state.thoughtStartedAtMs ?? Date.now());
      const trace = state.trace.slice();
      trace[open] = {
        type: "thought",
        text: joinThoughtChunks(existing.text, text),
        ...(mergedDuration !== undefined && mergedDuration > 0 ? { durationMs: mergedDuration } : {}),
        ...(startedAtMs !== undefined ? { startedAtMs } : {}),
      };
      return {
        ...state,
        trace,
        thoughtStartedAtMs: startedAtMs ?? null,
        promptInFlight: startedAtMs !== undefined ? true : state.promptInFlight,
      };
    }
  }
  const startedAtMs = resolvedDuration !== undefined ? undefined : Date.now();
  const trace = [
    ...state.trace,
    {
      type: "thought" as const,
      text,
      ...(resolvedDuration !== undefined ? { durationMs: resolvedDuration } : {}),
      ...(startedAtMs !== undefined ? { startedAtMs } : {}),
    },
  ];
  return {
    ...state,
    trace,
    openStreamIndex: trace.length - 1,
    thoughtStartedAtMs: startedAtMs ?? null,
    promptInFlight: startedAtMs !== undefined ? true : state.promptInFlight,
  };
}

/** Joins streamed thought chunks without inserting spaces between them. */
export function joinThoughtChunks(existing: string, incoming: string): string {
  return existing + incoming;
}

function rememberToolIndex(
  toolIndexById: Map<string, number>,
  toolCallId: string,
  index: number,
): void {
  toolIndexById.set(toolCallId, index);
  const canonicalId = canonicalToolCallId(toolCallId);
  if (canonicalId !== toolCallId) {
    toolIndexById.set(canonicalId, index);
  }
}

function sameToolImage(
  previous: AcpUiPromptImage | undefined,
  incoming: AcpUiPromptImage | undefined,
): boolean {
  return previous?.data === incoming?.data && previous?.mimeType === incoming?.mimeType;
}

/** Saves the viewport once an image arrives after the turn has already finished. */
function withLateToolImage(state: ChatState, changed: boolean): ChatState {
  if (!changed || state.promptInFlight) {
    return state;
  }
  return { ...state, visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(state) };
}

function mergeToolCwd(previous: string | undefined, incoming: string | undefined): string | undefined {
  if (incoming !== undefined && incoming.trim().length > 0) {
    return incoming.trim();
  }
  const prior = previous?.trim() ?? "";
  return prior.length > 0 ? prior : undefined;
}

function appendToolCall(
  state: ChatState,
  toolCallId: string,
  title: string,
  kind: string | undefined,
  status: ToolCallStatus | undefined,
  subtitle: string | undefined,
  durationMs: number | undefined,
  content: string | undefined,
  cwd: string | undefined,
  image: AcpUiPromptImage | undefined,
): ChatState {
  state = stateAfterLeavingOpenThoughtStream(state);
  const id = canonicalToolCallId(toolCallId);
  const existingIdx = resolveToolIndexByCallId(state.toolIndexById, toolCallId);
  if (existingIdx !== undefined) {
    const existing = state.trace[existingIdx];
    if (existing?.type === "tool") {
      const mergedStatus = status ?? existing.status;
      const mergedSubtitle =
        subtitle !== undefined && subtitle.trim().length > 0 ? subtitle.trim() : existing.subtitle;
      const mergedContent =
        content !== undefined && content.trim().length > 0 ? content : existing.content;
      const mergedKind = kind !== undefined ? kind : existing.kind;
      const knownStart = resolveToolStartedAtMs(state.toolStartedAtMsById, id) ?? existing.startedAtMs;
      const resolvedDuration = resolveToolDurationMs(
        durationMs,
        existing.durationMs,
        knownStart,
        mergedStatus,
      );
      const clock = trackToolClock(
        state.toolStartedAtMsById,
        id,
        mergedKind,
        title,
        mergedSubtitle,
        mergedContent,
        mergedStatus,
        knownStart,
        resolvedDuration,
      );
      const { startedAtMs: _previousStart, ...existingWithoutClock } = existing;
      const mergedCwd = mergeToolCwd(existing.cwd, cwd);
      const trace = state.trace.slice();
      trace[existingIdx] = {
        ...existingWithoutClock,
        title: toolDisplayTitle(mergedKind, title),
        kind: mergedKind,
        status: mergedStatus,
        subtitle: mergedSubtitle,
        ...(mergedCwd !== undefined ? { cwd: mergedCwd } : {}),
        content: mergedContent,
        detailVisible:
          (mergedContent !== undefined && mergedContent.trim().length > 0) ||
          (existing.diffRows !== undefined && existing.diffRows.length > 0),
        ...(image !== undefined ? { image } : {}),
        ...(resolvedDuration !== undefined ? { durationMs: resolvedDuration } : {}),
        ...(clock.startedAtMs !== undefined ? { startedAtMs: clock.startedAtMs } : {}),
      };
      const toolIndexById = new Map(state.toolIndexById);
      rememberToolIndex(toolIndexById, id, existingIdx);
      const toolStartedAtMsById = clock.toolStartedAtMsById;
      return withLateToolImage(
        {
          ...state,
          trace,
          toolIndexById,
          toolStartedAtMsById,
          openStreamIndex: null,
        },
        image !== undefined && !sameToolImage(existing.image, image),
      );
    }
  }
  const newStatus = status ?? "pending";
  const knownStart = resolveToolStartedAtMs(state.toolStartedAtMsById, id);
  const resolvedDuration = resolveToolDurationMs(durationMs, undefined, knownStart, newStatus);
  const clock = trackToolClock(
    state.toolStartedAtMsById,
    id,
    kind,
    title,
    subtitle,
    content,
    newStatus,
    knownStart,
    resolvedDuration,
  );
  const newCwd = mergeToolCwd(undefined, cwd);
  const newItem: TraceToolItem = {
    type: "tool",
    toolCallId: id,
    title: toolDisplayTitle(kind, title),
    kind,
    subtitle,
    ...(newCwd !== undefined ? { cwd: newCwd } : {}),
    status: newStatus,
    content: content !== undefined && content.trim().length > 0 ? content : undefined,
    diffRows: undefined,
    ...(image !== undefined ? { image } : {}),
    detailVisible: content !== undefined && content.trim().length > 0,
    ...(resolvedDuration !== undefined ? { durationMs: resolvedDuration } : {}),
    ...(clock.startedAtMs !== undefined ? { startedAtMs: clock.startedAtMs } : {}),
  };
  const trace = [...state.trace, newItem];
  const toolIndexById = new Map(state.toolIndexById);
  rememberToolIndex(toolIndexById, id, trace.length - 1);
  const toolStartedAtMsById = clock.toolStartedAtMsById;
  return {
    ...state,
    trace,
    toolIndexById,
    toolStartedAtMsById,
    openStreamIndex: null,
    promptInFlight: toolStatusIsLive(status) ? true : state.promptInFlight,
  };
}

function isBareSearchCount(text: string): boolean {
  return /^\d+\s+(?:matches|match|files|file|results|result)$/i.test(text.trim());
}

/** A later count does not replace the pattern and path already on the row. */
function mergeToolSubtitle(previous: string | undefined, incoming: string | undefined): string | undefined {
  if (incoming === undefined || incoming.trim().length === 0) {
    return previous;
  }
  const next = incoming.trim();
  const prior = previous?.trim() ?? "";
  if (prior.length > 0 && isBareSearchCount(next) && !isBareSearchCount(prior)) {
    if (prior === next || prior.endsWith(`· ${next}`)) {
      return prior;
    }
    return `${prior} · ${next}`;
  }
  return next;
}

function updateToolCall(
  state: ChatState,
  toolCallId: string,
  status: ToolCallStatus,
  content: string | undefined,
  subtitle: string | undefined,
  diffRows: ToolCallDiffRow[] | undefined,
  kind: string | undefined,
  durationMs: number | undefined,
  cwd: string | undefined,
  image: AcpUiPromptImage | undefined,
): ChatState {
  const id = canonicalToolCallId(toolCallId);
  const idx = resolveToolIndexByCallId(state.toolIndexById, toolCallId);
  if (idx !== undefined) {
    const item = state.trace[idx];
    if (item?.type !== "tool") {
      return state;
    }
    const mergedContent = content !== undefined ? content : item.content;
    const mergedDiffRows = diffRows !== undefined && diffRows.length > 0 ? diffRows : item.diffRows;
    const detailVisible =
      (mergedContent !== undefined && mergedContent.trim().length > 0) ||
      (mergedDiffRows !== undefined && mergedDiffRows.length > 0);
    const mergedSubtitle = mergeToolSubtitle(item.subtitle, subtitle);
    const mergedKind = kind !== undefined && kind.trim().length > 0 ? kind.trim() : item.kind;
    const inferredKind =
      mergedKind ??
      (mergedDiffRows !== undefined && mergedDiffRows.length > 0 ? "edit" : undefined);
    const mergedTitle = toolDisplayTitle(inferredKind, item.title);
    const knownStart = resolveToolStartedAtMs(state.toolStartedAtMsById, id) ?? item.startedAtMs;
    const resolvedDuration = resolveToolDurationMs(
      durationMs,
      item.durationMs,
      knownStart,
      status,
    );
    const clock = trackToolClock(
      state.toolStartedAtMsById,
      id,
      inferredKind,
      item.title,
      mergedSubtitle,
      mergedContent,
      status,
      knownStart,
      resolvedDuration,
    );
    const { startedAtMs: _previousStart, ...itemWithoutClock } = item;
    const mergedCwd = mergeToolCwd(item.cwd, cwd);
    const trace = state.trace.slice();
    trace[idx] = {
      ...itemWithoutClock,
      toolCallId: canonicalToolCallId(item.toolCallId),
      status,
      content: mergedContent,
      diffRows: mergedDiffRows,
      detailVisible,
      subtitle: mergedSubtitle,
      ...(mergedCwd !== undefined ? { cwd: mergedCwd } : {}),
      kind: inferredKind,
      title: mergedTitle,
      ...(image !== undefined ? { image } : {}),
      ...(resolvedDuration !== undefined ? { durationMs: resolvedDuration } : {}),
      ...(clock.startedAtMs !== undefined ? { startedAtMs: clock.startedAtMs } : {}),
    };
    const toolIndexById = new Map(state.toolIndexById);
    rememberToolIndex(toolIndexById, id, idx);
    const next = {
      ...state,
      trace,
      toolIndexById,
      toolStartedAtMsById: clock.toolStartedAtMsById,
      promptInFlight: toolStatusIsLive(status) ? true : state.promptInFlight,
    };
    return withLateToolImage(next, image !== undefined && !sameToolImage(item.image, image));
  }
  state = stateAfterLeavingOpenThoughtStream(state);
  const mergedContent = content;
  const mergedDiffRows = diffRows !== undefined && diffRows.length > 0 ? diffRows : undefined;
  const detailVisible =
    (mergedContent !== undefined && mergedContent.trim().length > 0) ||
    (mergedDiffRows !== undefined && mergedDiffRows.length > 0);
  const inferredKind =
    kind !== undefined && kind.trim().length > 0
      ? kind.trim()
      : mergedDiffRows !== undefined && mergedDiffRows.length > 0
        ? "edit"
        : undefined;
  const knownStart = resolveToolStartedAtMs(state.toolStartedAtMsById, id);
  const resolvedDuration = resolveToolDurationMs(durationMs, undefined, knownStart, status);
  const clock = trackToolClock(
    state.toolStartedAtMsById,
    id,
    inferredKind,
    "",
    subtitle,
    mergedContent,
    status,
    knownStart,
    resolvedDuration,
  );
  const newCwd = mergeToolCwd(undefined, cwd);
  const newItem: TraceToolItem = {
    type: "tool",
    toolCallId: id,
    title: toolDisplayTitle(inferredKind, ""),
    kind: inferredKind,
    subtitle: mergeToolSubtitle(undefined, subtitle),
    ...(newCwd !== undefined ? { cwd: newCwd } : {}),
    status,
    content: mergedContent,
    diffRows: mergedDiffRows,
    ...(image !== undefined ? { image } : {}),
    detailVisible,
    ...(resolvedDuration !== undefined ? { durationMs: resolvedDuration } : {}),
    ...(clock.startedAtMs !== undefined ? { startedAtMs: clock.startedAtMs } : {}),
  };
  const trace = [...state.trace, newItem];
  const toolIndexById = new Map(state.toolIndexById);
  rememberToolIndex(toolIndexById, id, trace.length - 1);
  const toolStartedAtMsById = clock.toolStartedAtMsById;
  return {
    ...state,
    trace,
    toolIndexById,
    toolStartedAtMsById,
    openStreamIndex: null,
    promptInFlight: toolStatusIsLive(status) ? true : state.promptInFlight,
  };
}

/** Attaches a file preview when the tool row is already on screen and has no image yet. */
function attachToolImage(state: ChatState, toolCallId: string, image: AcpUiPromptImage): ChatState {
  const idx = resolveToolIndexByCallId(state.toolIndexById, toolCallId);
  if (idx === undefined) {
    return state;
  }
  const item = state.trace[idx];
  if (item?.type !== "tool" || item.image !== undefined) {
    return state;
  }
  const trace = state.trace.slice();
  trace[idx] = { ...item, image };
  return withLateToolImage({ ...state, trace }, true);
}

/**
 * Applies extension protocol messages and local submit actions to chat UI state.
 */
function bumpVisibleTraceCacheEpoch(state: ChatState): number {
  return state.visibleTraceCacheEpoch + 1;
}

function applySessionReset(state: ChatState): ChatState {
  return {
    ...state,
    trace: [],
    openStreamIndex: null,
    toolIndexById: new Map(),
    promptInFlight: false,
    errorText: null,
    agentConnected: false,
    permissionPrompt: null,
    askQuestionPrompt: null,
    createPlanPrompt: null,
    sessionConfigOptions: null,
    modelSelection: null,
    sessionConfigLoading: true,
    sessionHistoryLoading: false,
    viewportCacheActive: false,
    replayTrace: [],
    replayToolIndexById: new Map(),
    replayOpenStreamIndex: null,
    replayThoughtStartedAtMs: null,
    replayToolStartedAtMsById: new Map(),
    thoughtDurations: [],
    bashDurations: [],
    composerPicksLocked: false,
    thoughtStartedAtMs: null,
    tokenUsage: null,
    toolStartedAtMsById: new Map(),
    subagentActivity: new Map(),
    subagentSessionByToolId: new Map(),
    visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(state),
  };
}

function isReplayTranscriptAction(action: ChatAction): boolean {
  switch (action.type) {
    case "appendAgentText":
    case "appendUserText":
    case "appendUserImage":
    case "appendAgentThought":
    case "appendToolCall":
    case "updateToolCall":
    case "toolImage":
    case "appendPlan":
    case "cursorUpdateTodos":
    case "cursorTask":
    case "cursorGenerateImage":
    case "turnComplete":
      return true;
    default:
      return false;
  }
}

function replayShadow(state: ChatState): ChatState {
  return {
    ...state,
    trace: state.replayTrace,
    toolIndexById: state.replayToolIndexById,
    openStreamIndex: state.replayOpenStreamIndex,
    thoughtStartedAtMs: state.replayThoughtStartedAtMs,
    toolStartedAtMsById: state.replayToolStartedAtMsById,
    sessionHistoryLoading: false,
    viewportCacheActive: false,
  };
}

function withReplayResult(state: ChatState, next: ChatState): ChatState {
  return {
    ...state,
    replayTrace: next.trace,
    replayToolIndexById: next.toolIndexById,
    replayOpenStreamIndex: next.openStreamIndex,
    replayThoughtStartedAtMs: next.thoughtStartedAtMs,
    replayToolStartedAtMsById: next.toolStartedAtMsById,
  };
}

function upsertCursorTask(
  state: ChatState,
  action: Extract<ChatAction, { type: "cursorTask" }>,
): ChatState {
  const base = stateAfterLeavingOpenThoughtStream(state);
  const title = `Task: ${action.description}`;
  const subtitle =
    action.subagentType.trim().length > 0 && action.subagentType !== "unspecified"
      ? action.subagentType.trim()
      : undefined;
  const prompt = action.prompt.trim();
  const idx = resolveToolIndexByCallId(base.toolIndexById, action.toolCallId);
  const existing = idx !== undefined ? base.trace[idx] : undefined;
  if (existing?.type === "tool" && idx !== undefined) {
    const running = existing.status === "pending" || existing.status === "in_progress";
    const content = prompt.length > 0 ? prompt : existing.content;
    const trace = base.trace.slice();
    trace[idx] = {
      ...existing,
      title: existing.title.startsWith("Task:") ? existing.title : title,
      subtitle: subtitle ?? existing.subtitle,
      content,
      detailVisible:
        (content !== undefined && content.trim().length > 0) ||
        (existing.diffRows !== undefined && existing.diffRows.length > 0),
      status: existing.status,
      ...(running || action.durationMs === undefined ? {} : { durationMs: action.durationMs }),
    };
    return finishCursorTask(base, trace, action.toolCallId, action.agentId ?? "");
  }
  const id = canonicalToolCallId(action.toolCallId);
  const trace = [
    ...base.trace,
    {
      type: "tool" as const,
      toolCallId: id,
      title,
      kind: "other",
      subtitle,
      status: action.durationMs === undefined ? ("in_progress" as const) : ("completed" as const),
      content: prompt.length > 0 ? prompt : undefined,
      diffRows: undefined,
      detailVisible: prompt.length > 0,
      ...(action.durationMs !== undefined ? { durationMs: action.durationMs } : {}),
    },
  ];
  return finishCursorTask(base, trace, action.toolCallId, action.agentId ?? "");
}

function finishCursorTask(
  base: ChatState,
  trace: TraceItem[],
  toolCallId: string,
  agentId: string,
): ChatState {
  const dropped = traceWithoutChildSession(trace, agentId);
  return {
    ...base,
    trace: dropped?.trace ?? trace,
    toolIndexById: dropped?.toolIndexById ?? reindexTools(trace),
    openStreamIndex: null,
    subagentSessionByToolId: rememberSubagentTool(
      base.subagentSessionByToolId,
      toolCallId,
      agentId,
    ),
    ...(dropped !== undefined
      ? { visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(base) }
      : {}),
  };
}

function blankSubagent(sessionId: string): SubagentTraceItem {
  return {
    type: "subagent",
    sessionId,
    title: "Subagent",
    description: "",
    state: null,
    stopReason: null,
  };
}

function patchSubagent(
  item: SubagentTraceItem,
  action: Extract<ChatAction, { type: "subagentUpdate" }>,
): SubagentTraceItem {
  const state = action.state === undefined ? item.state : action.state;
  const running = state === "running";
  const { startedAtMs: previousStart, ...rest } = item;
  return {
    ...rest,
    title: action.title === undefined ? item.title : (action.title ?? ""),
    description: action.description === undefined ? item.description : (action.description ?? ""),
    state,
    stopReason: action.stopReason === undefined ? item.stopReason : action.stopReason,
    ...(running ? { startedAtMs: previousStart ?? Date.now() } : {}),
  };
}

function rememberSubagentTool(
  map: Map<string, string>,
  toolCallId: string | undefined,
  sessionId: string,
): Map<string, string> {
  if (toolCallId === undefined || toolCallId.length === 0 || sessionId.length === 0) {
    return map;
  }
  const key = canonicalToolCallId(toolCallId);
  const existing = map.get(key);
  if (existing === sessionId) {
    return map;
  }
  // Cursor's live session id is `agentId.run`. A later `cursor/task` agentId must not replace it.
  if (existing !== undefined && existing.startsWith(`${sessionId}.`)) {
    return map;
  }
  const next = new Map(map);
  next.set(key, sessionId);
  return next;
}

function sessionIdsReferToSameChild(stored: string, incoming: string): boolean {
  return (
    stored === incoming || incoming.startsWith(`${stored}.`) || stored.startsWith(`${incoming}.`)
  );
}

function reindexTools(trace: readonly TraceItem[]): Map<string, number> {
  const toolIndexById = new Map<string, number>();
  for (let index = 0; index < trace.length; index++) {
    const item = trace[index];
    if (item?.type === "tool") {
      rememberToolIndex(toolIndexById, item.toolCallId, index);
    }
  }
  return toolIndexById;
}

/** Drops the child-session row once a task card on this trace owns that child. */
function traceWithoutChildSession(
  trace: TraceItem[],
  sessionId: string,
): { trace: TraceItem[]; toolIndexById: Map<string, number> } | undefined {
  if (sessionId.length === 0) {
    return undefined;
  }
  const drops = trace.some(
    (item) => item.type === "subagent" && sessionIdsReferToSameChild(item.sessionId, sessionId),
  );
  if (!drops) {
    return undefined;
  }
  const nextTrace = trace.filter(
    (item) => !(item.type === "subagent" && sessionIdsReferToSameChild(item.sessionId, sessionId)),
  );
  return { trace: nextTrace, toolIndexById: reindexTools(nextTrace) };
}

/** True when a task card in this trace already represents the child session. */
export function traceCoversSubagentSession(
  items: readonly TraceItem[],
  sessionByToolId: ReadonlyMap<string, string>,
  sessionId: string,
): boolean {
  for (const item of items) {
    if (item.type !== "tool" || subagentTaskViewFromTool(item) === undefined) {
      continue;
    }
    const linked = sessionByToolId.get(canonicalToolCallId(item.toolCallId));
    if (linked !== undefined && sessionIdsReferToSameChild(linked, sessionId)) {
      return true;
    }
  }
  return false;
}

function sessionHasToolLink(map: Map<string, string>, sessionId: string): boolean {
  for (const id of map.values()) {
    if (sessionIdsReferToSameChild(id, sessionId)) {
      return true;
    }
  }
  return false;
}

/** Child transcript for a task, including Cursor's `agentId.run` session id. */
export function activityTraceForTool(state: ChatState, toolCallId: string): readonly TraceItem[] {
  const sessionId = state.subagentSessionByToolId.get(canonicalToolCallId(toolCallId));
  if (sessionId === undefined) {
    return [];
  }
  const exact = state.subagentActivity.get(sessionId);
  if (exact !== undefined) {
    return exact.trace;
  }
  for (const [id, bucket] of state.subagentActivity) {
    if (sessionIdsReferToSameChild(sessionId, id)) {
      return bucket.trace;
    }
  }
  return [];
}

type LinkedToolPatch = {
  status: ToolCallStatus;
  taskStopReason?: string;
  clearDuration: boolean;
  clearStopReason?: boolean;
};

function linkedToolStatus(
  action: Extract<ChatAction, { type: "subagentUpdate" }>,
): LinkedToolPatch | undefined {
  if (action.state === undefined) {
    return undefined;
  }
  if (action.state === null || action.state === "unknown") {
    return { status: "in_progress", taskStopReason: "unknown", clearDuration: false };
  }
  if (action.state === "requires_action") {
    return { status: "in_progress", taskStopReason: "requires_action", clearDuration: true };
  }
  if (action.state === "running") {
    return { status: "in_progress", clearDuration: true, clearStopReason: true };
  }
  if (action.state === "idle" && action.stopReason === "error") {
    return { status: "failed", taskStopReason: "error", clearDuration: false };
  }
  if (action.state === "idle" && action.stopReason === "cancelled") {
    return { status: "completed", taskStopReason: "cancelled", clearDuration: false };
  }
  if (action.state === "idle") {
    return { status: "completed", clearDuration: false, clearStopReason: true };
  }
  return undefined;
}

function applyLinkedToolStatus(
  trace: TraceItem[],
  toolIndexById: Map<string, number>,
  toolCallId: string,
  patch: LinkedToolPatch,
): TraceItem[] {
  const idx = resolveToolIndexByCallId(toolIndexById, toolCallId);
  if (idx === undefined) {
    return trace;
  }
  const current = trace[idx];
  if (current?.type !== "tool") {
    return trace;
  }
  const taskStopReason =
    patch.taskStopReason !== undefined
      ? patch.taskStopReason
      : patch.clearStopReason
        ? undefined
        : current.taskStopReason;
  const running = patch.status === "pending" || patch.status === "in_progress";
  const next = trace.slice();
  next[idx] = {
    ...current,
    status: patch.status,
    taskStopReason,
    ...(running ? { startedAtMs: current.startedAtMs ?? Date.now() } : { startedAtMs: undefined }),
    ...(patch.clearDuration ? { durationMs: undefined } : {}),
  };
  return next;
}

function subagentUpdateHasDisplay(
  action: Extract<ChatAction, { type: "subagentUpdate" }>,
): boolean {
  return (
    action.title !== undefined ||
    action.description !== undefined ||
    action.state !== undefined ||
    action.stopReason !== undefined
  );
}

function placeSubagent(
  trace: TraceItem[],
  action: Extract<ChatAction, { type: "subagentUpdate" }>,
): TraceItem[] {
  const linked =
    action.toolCallId !== undefined &&
    action.toolCallId.length > 0 &&
    subagentUpdateHasDisplay(action);
  if (linked) {
    let next = trace.filter(
      (item) =>
        !(item.type === "subagent" && sessionIdsReferToSameChild(item.sessionId, action.sessionId)),
    );
    const patch = linkedToolStatus(action);
    if (patch !== undefined && action.toolCallId !== undefined) {
      next = applyLinkedToolStatus(next, reindexTools(next), action.toolCallId, patch);
    }
    return next;
  }
  const next = trace.slice();
  const index = next.findIndex(
    (item) => item.type === "subagent" && item.sessionId === action.sessionId,
  );
  if (index >= 0) {
    const current = next[index];
    if (current?.type === "subagent") {
      next[index] = patchSubagent(current, action);
    }
    return next;
  }
  next.push(patchSubagent(blankSubagent(action.sessionId), action));
  return next;
}

function parentSessionIsKnown(state: ChatState, parentSessionId: string): boolean {
  if (state.subagentActivity.has(parentSessionId)) {
    return true;
  }
  if (sessionHasToolLink(state.subagentSessionByToolId, parentSessionId)) {
    return true;
  }
  return state.trace.some(
    (item) => item.type === "subagent" && item.sessionId === parentSessionId,
  );
}

function applySubagentUpdate(
  state: ChatState,
  action: Extract<ChatAction, { type: "subagentUpdate" }>,
): ChatState {
  const subagentSessionByToolId = rememberSubagentTool(
    state.subagentSessionByToolId,
    action.toolCallId,
    action.sessionId,
  );
  if (!subagentUpdateHasDisplay(action)) {
    const toolOnTrace =
      action.toolCallId !== undefined &&
      resolveToolIndexByCallId(state.toolIndexById, action.toolCallId) !== undefined;
    const dropped = toolOnTrace ? traceWithoutChildSession(state.trace, action.sessionId) : undefined;
    if (dropped === undefined) {
      return { ...state, subagentSessionByToolId };
    }
    return {
      ...state,
      trace: dropped.trace,
      toolIndexById: dropped.toolIndexById,
      subagentSessionByToolId,
      visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(state),
    };
  }
  const parentSessionId = action.parentSessionId;
  if (
    parentSessionId !== undefined &&
    parentSessionId.length > 0 &&
    parentSessionIsKnown(state, parentSessionId)
  ) {
    const current = state.subagentActivity.get(parentSessionId) ?? {
      trace: [],
      toolIndexById: new Map<string, number>(),
      openStreamIndex: null,
    };
    const subagentActivity = new Map(state.subagentActivity);
    const nestedTrace = placeSubagent(current.trace, action);
    subagentActivity.set(parentSessionId, {
      ...current,
      trace: nestedTrace,
      toolIndexById:
        nestedTrace.length === current.trace.length
          ? current.toolIndexById
          : reindexTools(nestedTrace),
    });
    return {
      ...state,
      subagentActivity,
      subagentSessionByToolId,
      visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(state),
    };
  }
  const nextTrace = placeSubagent(state.trace, action);
  return {
    ...state,
    trace: nextTrace,
    toolIndexById:
      nextTrace.length === state.trace.length ? state.toolIndexById : reindexTools(nextTrace),
    subagentSessionByToolId,
    visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(state),
  };
}

/** A lost ACP connection is not a confirmed running child. */
function markLiveSubagentsUnknown(state: ChatState): ChatState {
  let changed = false;
  const trace = state.trace.map((item) => {
    if (
      item.type === "subagent" &&
      (item.state === "running" || item.state === "requires_action")
    ) {
      changed = true;
      return { ...item, state: "unknown" as const, stopReason: null };
    }
    if (
      item.type === "tool" &&
      (item.status === "pending" || item.status === "in_progress") &&
      item.taskStopReason !== "unknown" &&
      state.subagentSessionByToolId.has(canonicalToolCallId(item.toolCallId))
    ) {
      changed = true;
      return { ...item, taskStopReason: "unknown" };
    }
    return item;
  });
  if (!changed) {
    return state;
  }
  return {
    ...state,
    trace,
    visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(state),
  };
}

function applySubagentActivity(
  state: ChatState,
  sessionId: string,
  event: SubagentActivityEvent,
): ChatState {
  const current = state.subagentActivity.get(sessionId) ?? {
    trace: [],
    toolIndexById: new Map<string, number>(),
    openStreamIndex: null,
  };
  const shadow = chatReducer(
    {
      ...createInitialChatState(),
      trace: current.trace,
      toolIndexById: current.toolIndexById,
      openStreamIndex: current.openStreamIndex,
    },
    event,
  );
  const subagentActivity = new Map(state.subagentActivity);
  subagentActivity.set(sessionId, {
    trace: shadow.trace,
    toolIndexById: shadow.toolIndexById,
    openStreamIndex: shadow.openStreamIndex,
  });
  const linked = sessionHasToolLink(state.subagentSessionByToolId, sessionId);
  const hasCard =
    linked ||
    state.trace.some((item) => item.type === "subagent" && item.sessionId === sessionId);
  const trace = hasCard
    ? state.trace
    : [
        ...state.trace,
        { ...blankSubagent(sessionId), state: "running" as const, startedAtMs: Date.now() },
      ];
  return {
    ...state,
    trace,
    subagentActivity,
    ...(hasCard ? {} : { visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(state) }),
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (state.viewportCacheActive && state.sessionHistoryLoading && isReplayTranscriptAction(action)) {
    return withReplayResult(state, chatReducer(replayShadow(state), action));
  }
  if (action.type === "submit") {
    const afterThought = stateAfterLeavingOpenThoughtStream(state);
    return {
      ...afterThought,
      trace: [
        ...afterThought.trace,
        {
          type: "user",
          text: action.body,
          ...(action.imageCount !== undefined ? { imageCount: action.imageCount } : {}),
          ...(action.images !== undefined && action.images.length > 0 ? { images: action.images } : {}),
        },
      ],
      promptInFlight: true,
      errorText: state.agentConnected ? null : state.errorText,
      openStreamIndex: null,
      toolIndexById: new Map(),
      toolStartedAtMsById: new Map(),
      composerPicksLocked: state.lockSessionAgent === true ? state.composerPicksLocked : true,
    };
  }
  if (action.type === "pickSessionAgent") {
    if (state.trace.length > 0 || state.acpAgentSelection?.currentName === action.agentName) {
      return state;
    }
    return {
      ...state,
      acpAgentSelection: { currentName: action.agentName },
      modelSelection: null,
      sessionConfigOptions: null,
      sessionConfigLoading: true,
    };
  }
  if (action.type === "pickSessionModel") {
    if (state.composerPicksLocked || state.modelSelection === null) {
      return state;
    }
    if (state.sessionConfigOptions !== null) {
      const modelOption = modelConfigOption({
        options: state.sessionConfigOptions,
      });
      if (modelOption !== undefined) {
        const cached = readCachedModelParamOptions(
          agentNameFromState(state),
          modelParamCacheKey(action.modelId, modelOption),
        );
        return applySessionConfigOptions(
          state,
          resolvedModelParamOptionsForModelPick(
            state.sessionConfigOptions,
            modelOption.configId,
            action.modelId,
            cached,
          ),
        );
      }
    }
    return {
      ...state,
      modelSelection: {
        ...state.modelSelection,
        currentModelId: action.modelId,
      },
    };
  }
  if (action.type === "pickSessionConfigOption") {
    if (state.composerPicksLocked || state.sessionConfigOptions === null) {
      return state;
    }
    const isModelPick = isModelConfigPick(state.sessionConfigOptions, action.configId);
    if (isModelPick && typeof action.value === "string" && action.value.length > 0) {
      const modelOption = modelConfigOption({
        options: state.sessionConfigOptions,
      });
      const cached = readCachedModelParamOptions(
        agentNameFromState(state),
        modelParamCacheKey(action.value, modelOption),
      );
      return applySessionConfigOptions(
        state,
        resolvedModelParamOptionsForModelPick(
          state.sessionConfigOptions,
          action.configId,
          action.value,
          cached,
        ),
      );
    }
    const nextOptions = state.sessionConfigOptions.map((option) => {
      if (option.configId !== action.configId) {
        return option;
      }
      if (option.type === "boolean") {
        return {
          ...option,
          currentValue: typeof action.value === "boolean" ? action.value : action.value === "true",
        };
      }
      return {
        ...option,
        currentValue: typeof action.value === "string" ? action.value : option.currentValue,
      };
    });
    return applySessionConfigOptions(state, nextOptions);
  }
  if (action.type === "clearPermissionPrompt") {
    return { ...state, permissionPrompt: null };
  }
  if (action.type === "clearAskQuestionPrompt") {
    return { ...state, askQuestionPrompt: null };
  }
  if (action.type === "clearCreatePlanPrompt") {
    return { ...state, createPlanPrompt: null };
  }
  switch (action.type) {
    case "sessionReset":
      return applySessionReset(state);
    case "sessionModels": {
      const modelSelection = {
        currentModelId: action.currentModelId,
        availableModels: action.availableModels,
      };
      const agentName = agentNameFromState(state);
      if (agentName.length > 0) {
        writeCachedSessionModels(agentName, modelSelection);
      }
      return {
        ...state,
        modelSelection,
        sessionConfigLoading: false,
      };
    }
    case "sessionConfigOptions":
      return applySessionConfigOptions(state, action.options);
    case "sessionConfigOptionsLoading":
      return applySessionConfigOptionsLoading(state);
    case "recentSessions":
      return { ...state, recentSessions: action.sessions };
    case "sessionTitle": {
      const title = action.title.trim();
      if (title.length === 0 || title === state.sessionTitle) {
        return state;
      }
      return { ...state, sessionTitle: title };
    }
    case "sessionHistoryLoading": {
      if (action.loading) {
        return {
          ...state,
          sessionHistoryLoading: true,
          thoughtDurations: mergeThoughtDurationLists(
            state.thoughtDurations,
            thoughtDurationsFromTrace(state.trace),
          ),
          bashDurations: mergeBashDurationLists(
            state.bashDurations,
            bashDurationsFromTrace(state.trace),
          ),
        };
      }
      if (state.viewportCacheActive && state.replayTrace.length > 0) {
        const trace = settleOpenThoughts(
          mergeToolDurationsFromCache(
            applyBashDurations(
              mergeThoughtDurationsFromCache(
                applyThoughtDurationList(state.replayTrace, state.thoughtDurations),
                state.trace,
              ),
              state.bashDurations,
            ),
            state.trace,
          ),
        );
        const toolStartedAtMsById = toolClocksFromTrace(trace);
        return {
          ...state,
          sessionHistoryLoading: false,
          viewportCacheActive: false,
          trace,
          thoughtDurations: thoughtDurationsFromTrace(trace),
          bashDurations: bashDurationsFromTrace(trace),
          toolIndexById: state.replayToolIndexById,
          openStreamIndex: null,
          thoughtStartedAtMs: null,
          toolStartedAtMsById,
          promptInFlight: toolStartedAtMsById.size > 0,
          replayTrace: [],
          replayToolIndexById: new Map(),
          replayOpenStreamIndex: null,
          replayThoughtStartedAtMs: null,
          replayToolStartedAtMsById: new Map(),
          historyCommit: state.historyCommit + 1,
          visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(state),
        };
      }
      const trace = settleOpenThoughts(state.trace);
      const toolStartedAtMsById = toolClocksFromTrace(trace);
      const thoughtDurations = thoughtDurationsFromTrace(trace);
      const bashDurations = bashDurationsFromTrace(trace);
      return {
        ...state,
        sessionHistoryLoading: false,
        viewportCacheActive: false,
        trace,
        thoughtDurations,
        bashDurations,
        openStreamIndex: null,
        thoughtStartedAtMs: null,
        toolStartedAtMsById,
        promptInFlight: toolStartedAtMsById.size > 0,
        ...(thoughtDurations.length > 0 || bashDurations.length > 0
          ? { visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(state) }
          : {}),
      };
    }
    case "appendAgentText":
      return appendAgentText(state, action.text);
    case "appendUserText":
      return appendUserText(state, action.text);
    case "appendUserImage":
      return appendUserImage(state, action.image);
    case "appendAgentThought":
      return appendAgentThought(state, action.text, action.durationMs);
    case "appendToolCall":
      return appendToolCall(
        state,
        action.toolCallId,
        action.title,
        action.kind,
        action.status,
        action.subtitle,
        action.durationMs,
        action.content,
        action.cwd,
        action.image,
      );
    case "updateToolCall":
      return updateToolCall(
        state,
        action.toolCallId,
        action.status,
        action.content,
        action.subtitle,
        action.diffRows,
        action.kind,
        action.durationMs,
        action.cwd,
        action.image,
      );
    case "toolImage":
      return attachToolImage(state, action.toolCallId, action.image);
    case "slashCommands":
      return { ...state, slashCommands: action.commands };
    case "promptImageSupport":
      return { ...state, promptImageSupported: action.supported };
    case "subagentUpdate":
      return applySubagentUpdate(state, action);
    case "subagentActivity":
      return applySubagentActivity(state, action.sessionId, action.event);
    case "tokenUsage":
      return {
        ...state,
        tokenUsage: {
          used: action.used,
          size: action.size !== undefined ? action.size : (state.tokenUsage?.size ?? null),
        },
      };
    case "permissionRequest":
      return {
        ...state,
        permissionPrompt: {
          requestId: action.requestId,
          toolTitle: action.toolTitle,
          ...(action.detail !== undefined ? { detail: action.detail } : {}),
          ...(action.summary !== undefined ? { summary: action.summary } : {}),
          ...(action.diffRows !== undefined ? { diffRows: action.diffRows } : {}),
          options: action.options,
        },
      };
    case "cursorAskQuestionRequest":
      return { ...state, askQuestionPrompt: action };
    case "cursorCreatePlanRequest":
      return { ...state, createPlanPrompt: action };
    case "cursorUpdateTodos": {
      const base = stateAfterLeavingOpenThoughtStream(state);
      const trace = [
        ...base.trace,
        {
          type: "plan" as const,
          entries: action.todos.map((todo) => ({
            content: todo.content,
            status: todo.status,
          })),
        },
      ];
      return { ...base, trace, openStreamIndex: null };
    }
    case "cursorTask":
      return upsertCursorTask(state, action);
    case "cursorGenerateImage": {
      const base = stateAfterLeavingOpenThoughtStream(state);
      const text =
        action.filePath !== undefined
          ? `Generated image: ${action.filePath}`
          : `Generate image requested: ${action.description}`;
      const trace = [...base.trace, { type: "agent" as const, text }];
      return { ...base, trace, openStreamIndex: trace.length - 1 };
    }
    case "appendPlan": {
      const base = stateAfterLeavingOpenThoughtStream(state);
      const trace = [...base.trace, { type: "plan" as const, entries: action.entries }];
      return {
        ...base,
        trace,
        openStreamIndex: null,
      };
    }
    case "agentConnection":
      return {
        ...state,
        agentConnected: action.connected,
        ...(action.connected ? { errorText: null } : {}),
      };
    case "commandFeedback": {
      const base = stateAfterLeavingOpenThoughtStream(state);
      const trace = [...base.trace, { type: "agent" as const, text: action.message }];
      return {
        ...base,
        trace,
        openStreamIndex: trace.length - 1,
        promptInFlight: false,
        errorText: null,
        visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(base),
      };
    }
    case "stopTurn": {
      const base = finalizeOpenThoughtDuration(state);
      return {
        ...base,
        promptInFlight: false,
      };
    }
    case "turnComplete": {
      const base = finalizeOpenThoughtDuration(state);
      return {
        ...base,
        openStreamIndex: null,
        promptInFlight: false,
        visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(base),
      };
    }
    case "error": {
      const base = finalizeOpenThoughtDuration(state);
      const replay =
        state.viewportCacheActive && state.sessionHistoryLoading
          ? finalizeOpenThoughtDuration(replayShadow(state))
          : null;
      const disconnected = action.disconnected === true;
      const withUnknown = disconnected ? markLiveSubagentsUnknown(base) : base;
      const trace =
        disconnected && action.message.trim().length > 0
          ? [...withUnknown.trace, { type: "agent" as const, text: action.message }]
          : withUnknown.trace;
      return {
        ...withUnknown,
        trace,
        ...(replay !== null
          ? {
              replayTrace: replay.trace,
              replayOpenStreamIndex: null,
              replayThoughtStartedAtMs: null,
            }
          : {}),
        openStreamIndex: null,
        errorText: action.message,
        agentConnected: disconnected ? false : state.agentConnected,
        promptInFlight: false,
        visibleTraceCacheEpoch: bumpVisibleTraceCacheEpoch(base),
      };
    }
    default:
      return state;
  }
}

/**
 * Replays persisted session log events onto the initial state from `init`.
 */
export function replayChatState(
  init: InitPayload,
  events: Array<ExtensionMessageAfterInit | { type: "submit"; body: string }>,
): ChatState {
  let state = createChatStateFromInit(init);
  for (const event of events) {
    state = chatReducer(state, event as ChatAction);
  }
  return state;
}
