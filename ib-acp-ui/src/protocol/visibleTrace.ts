export const maxVisibleTraceItems = 40;

type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";

type ToolCallDiffRow = {
    kind: "removed" | "added" | "context";
    text: string;
    line?: number;
};

type PlanEntry = {
    content: string;
    status: string;
    priority?: string;
};

export type AcpUiVisibleTraceItem =
    | {
          type: "user";
          text: string;
          imageCount?: number;
          images?: { data: string; mimeType: string }[];
      }
    | { type: "thought"; text: string; durationMs?: number; startedAtMs?: number }
    | { type: "agent"; text: string }
    | {
          type: "tool";
          toolCallId: string;
          title: string;
          kind?: string;
          subtitle?: string;
          status: ToolCallStatus;
          content?: string;
          diffRows?: ToolCallDiffRow[];
          detailVisible?: boolean;
          durationMs?: number;
          startedAtMs?: number;
      }
    | { type: "plan"; entries: PlanEntry[] }
    | {
          type: "subagent";
          sessionId: string;
          title: string;
          description: string;
          state: "running" | "idle" | "requires_action" | "unknown" | null;
          stopReason: string | null;
          startedAtMs?: number;
      };

const toolCallStatuses = new Set<ToolCallStatus>(["pending", "in_progress", "completed", "failed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object";
}

function optionalString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

/** Positive finite millisecond durations only (0 / negative are treated as missing). */
export function positiveDurationMs(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function positiveInteger(value: unknown): number | undefined {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

/** Thought heading clock, always seconds with one decimal (for example `0.4s`, `1.2s`). */
export function formatThoughtSeconds(durationMs: number): string {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
        return "";
    }
    return `${(durationMs / 1000).toFixed(1)}s`;
}

/** Compact clock label for thought and command durations (for example `450ms`, `1.2s`). */
export function formatCompactDurationMs(durationMs: number): string {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
        return "";
    }
    if (durationMs < 1000) {
        return `${Math.round(durationMs)}ms`;
    }
    return `${(durationMs / 1000).toFixed(1)}s`;
}

function parseDiffRows(value: unknown): ToolCallDiffRow[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const rows: ToolCallDiffRow[] = [];
    for (const row of value) {
        if (!isRecord(row)) {
            continue;
        }
        if (row.kind !== "removed" && row.kind !== "added" && row.kind !== "context") {
            continue;
        }
        if (typeof row.text !== "string") {
            continue;
        }
        const line = positiveInteger(row.line);
        rows.push({
            kind: row.kind,
            text: row.text,
            ...(line !== undefined ? { line } : {}),
        });
    }
    return rows.length > 0 ? rows : undefined;
}

function parsePlanEntries(value: unknown): PlanEntry[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const entries: PlanEntry[] = [];
    for (const row of value) {
        if (!isRecord(row) || typeof row.content !== "string" || typeof row.status !== "string") {
            continue;
        }
        const priority = optionalString(row.priority);
        entries.push({
            content: row.content,
            status: row.status,
            ...(priority !== undefined ? { priority } : {}),
        });
    }
    return entries.length > 0 ? entries : undefined;
}

function userImages(value: unknown): { data: string; mimeType: string }[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const images: { data: string; mimeType: string }[] = [];
    for (const item of value) {
        if (images.length >= 8) {
            break;
        }
        if (!isRecord(item)) {
            continue;
        }
        if (typeof item.data !== "string" || item.data.length === 0) {
            continue;
        }
        if (typeof item.mimeType !== "string" || !item.mimeType.startsWith("image/")) {
            continue;
        }
        images.push({ data: item.data, mimeType: item.mimeType });
    }
    return images.length > 0 ? images : undefined;
}

function parseVisibleTraceItem(value: unknown): AcpUiVisibleTraceItem | null {
    if (!isRecord(value) || typeof value.type !== "string") {
        return null;
    }
    if (value.type === "meta") {
        return null;
    }
    if (value.type === "user" || value.type === "agent") {
        if (typeof value.text !== "string") {
            return null;
        }
        if (value.type === "agent") {
            return { type: "agent", text: value.text };
        }
        const imageCount = positiveInteger(value.imageCount);
        const images = userImages(value.images);
        return {
            type: "user",
            text: value.text,
            ...(imageCount !== undefined ? { imageCount } : {}),
            ...(images !== undefined ? { images } : {}),
        };
    }
    if (value.type === "thought") {
        if (typeof value.text !== "string") {
            return null;
        }
        const durationMs = positiveDurationMs(value.durationMs);
        const startedAtMs = positiveDurationMs(value.startedAtMs);
        return {
            type: "thought",
            text: value.text,
            ...(durationMs !== undefined ? { durationMs } : {}),
            ...(durationMs === undefined && startedAtMs !== undefined ? { startedAtMs } : {}),
        };
    }
    if (value.type === "subagent") {
        if (typeof value.sessionId !== "string" || value.sessionId.length === 0) {
            return null;
        }
        const state = value.state;
        const work =
            state === "running" ||
            state === "idle" ||
            state === "requires_action" ||
            state === "unknown"
                ? state
                : null;
        const startedAtMs = positiveDurationMs(value.startedAtMs);
        return {
            type: "subagent",
            sessionId: value.sessionId,
            title:
                typeof value.title === "string" && value.title.trim().length > 0
                    ? value.title
                    : "Subagent",
            description: typeof value.description === "string" ? value.description : "",
            state: work,
            stopReason: typeof value.stopReason === "string" ? value.stopReason : null,
            ...(work === "running" && startedAtMs !== undefined ? { startedAtMs } : {}),
        };
    }
    if (value.type === "plan") {
        const entries = parsePlanEntries(value.entries);
        if (entries === undefined) {
            return null;
        }
        return { type: "plan", entries };
    }
    if (value.type !== "tool") {
        return null;
    }
    if (typeof value.toolCallId !== "string" || value.toolCallId.length === 0) {
        return null;
    }
    if (typeof value.title !== "string") {
        return null;
    }
    if (typeof value.status !== "string" || !toolCallStatuses.has(value.status as ToolCallStatus)) {
        return null;
    }
    const kind = optionalString(value.kind);
    const subtitle = optionalString(value.subtitle);
    const content = optionalString(value.content);
    const diffRows = parseDiffRows(value.diffRows);
    const detailVisible = value.detailVisible === true;
    const durationMs = positiveDurationMs(value.durationMs);
    const startedAtMs = positiveDurationMs(value.startedAtMs);
    const running = value.status === "pending" || value.status === "in_progress";
    return {
        type: "tool",
        toolCallId: value.toolCallId,
        title: value.title,
        status: value.status as ToolCallStatus,
        ...(kind !== undefined ? { kind } : {}),
        ...(subtitle !== undefined ? { subtitle } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(diffRows !== undefined ? { diffRows } : {}),
        ...(detailVisible ? { detailVisible } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...(durationMs === undefined && running && startedAtMs !== undefined
            ? { startedAtMs }
            : {}),
    };
}

/**
 * Keeps valid trace items and caps the list at the viewport tail.
 */
export function normalizeVisibleTrace(entries: unknown): AcpUiVisibleTraceItem[] {
    if (!Array.isArray(entries)) {
        return [];
    }
    const out: AcpUiVisibleTraceItem[] = [];
    for (const item of entries) {
        const parsed = parseVisibleTraceItem(item);
        if (parsed !== null) {
            out.push(parsed);
        }
    }
    if (out.length > maxVisibleTraceItems) {
        return out.slice(out.length - maxVisibleTraceItems);
    }
    return out;
}
