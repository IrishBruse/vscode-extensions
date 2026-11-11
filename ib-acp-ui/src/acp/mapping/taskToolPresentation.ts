import { positiveDurationMs } from "../../protocol/visibleTrace";

export type TaskToolFields = {
    description: string;
    prompt: string;
    subagentType: string;
};

export type SubagentTaskView = {
    description: string;
    prompt: string;
    subagentType: string;
    durationMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function subagentTypeFromUnknown(value: unknown): string {
    if (typeof value === "string") {
        return value.trim();
    }
    if (isRecord(value) && typeof value.custom === "string") {
        return value.custom.trim();
    }
    return "";
}

/**
 * Cursor task tools send `_toolName: "task"` plus prompt, description, and subagent type.
 * A JSON string of that object is the same payload after it was dumped into a subtitle.
 */
export function taskToolFieldsFromRaw(raw: unknown): TaskToolFields | undefined {
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!trimmed.startsWith("{")) {
            return undefined;
        }
        try {
            return taskToolFieldsFromRaw(JSON.parse(trimmed) as unknown);
        } catch {
            return undefined;
        }
    }
    if (!isRecord(raw)) {
        return undefined;
    }
    const prompt = typeof raw.prompt === "string" ? raw.prompt : undefined;
    const description = typeof raw.description === "string" ? raw.description.trim() : undefined;
    const subagentType = subagentTypeFromUnknown(raw.subagentType);
    const isTask =
        raw._toolName === "task" ||
        (prompt !== undefined && description !== undefined && subagentType.length > 0);
    if (!isTask) {
        return undefined;
    }
    return {
        description:
            description !== undefined && description.length > 0 ? description : "Subagent task",
        prompt: prompt ?? "",
        subagentType,
    };
}

/** True when Cursor handed the task to a subagent that is still running. */
export function taskOutputIsBackground(raw: unknown): boolean {
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!trimmed.startsWith("{")) {
            return false;
        }
        try {
            return taskOutputIsBackground(JSON.parse(trimmed) as unknown);
        } catch {
            return false;
        }
    }
    return isRecord(raw) && raw.isBackground === true;
}

/** Duration on a completed Cursor task `rawOutput` (`{ durationMs, isBackground }`). */
export function taskDurationMsFromRawOutput(raw: unknown): number | undefined {
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!trimmed.startsWith("{")) {
            return undefined;
        }
        try {
            return taskDurationMsFromRawOutput(JSON.parse(trimmed) as unknown);
        } catch {
            return undefined;
        }
    }
    if (!isRecord(raw) || typeof raw.durationMs !== "number") {
        return undefined;
    }
    if (typeof raw.prompt === "string" || typeof raw.description === "string") {
        return undefined;
    }
    return positiveDurationMs(raw.durationMs);
}

function visibleSubagentType(subagentType: string): string {
    const trimmed = subagentType.trim();
    if (trimmed.length === 0 || trimmed === "unspecified" || trimmed === "subagent") {
        return "";
    }
    return trimmed;
}

/**
 * How a tool row should render when it is a Cursor subagent task.
 * Accepts the structured subtitle/content mapping and the older raw-JSON subtitle.
 */
export function subagentTaskViewFromTool(item: {
    title: string;
    subtitle?: string;
    content?: string;
    durationMs?: number;
}): SubagentTaskView | undefined {
    const fromSubtitle = taskToolFieldsFromRaw(item.subtitle);
    const fromContent =
        fromSubtitle === undefined ? taskToolFieldsFromRaw(item.content) : undefined;
    const fields = fromSubtitle ?? fromContent;
    if (fields !== undefined) {
        const durationMs =
            item.durationMs ??
            (fromSubtitle !== undefined ? taskDurationMsFromRawOutput(item.content) : undefined);
        return {
            description: fields.description,
            prompt: fields.prompt,
            subagentType: visibleSubagentType(fields.subagentType),
            ...(durationMs !== undefined ? { durationMs } : {}),
        };
    }
    const title = item.title.trim();
    const description = title.startsWith("Task:") ? title.slice("Task:".length).trim() : "";
    if (description.length === 0) {
        return undefined;
    }
    const subtitle = item.subtitle?.trim() ?? "";
    if (subtitle.startsWith("{") || subtitle.startsWith("[")) {
        return undefined;
    }
    if (subtitle.length > 0 && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(subtitle)) {
        return undefined;
    }
    const content = item.content ?? "";
    const outputDuration = taskDurationMsFromRawOutput(content);
    const prompt = outputDuration !== undefined && content.trim().startsWith("{") ? "" : content;
    const durationMs = item.durationMs ?? outputDuration;
    return {
        description,
        prompt,
        subagentType: visibleSubagentType(subtitle),
        ...(durationMs !== undefined ? { durationMs } : {}),
    };
}
