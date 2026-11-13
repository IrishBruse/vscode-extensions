import { type PermissionGrant, normalizePermissionGrants } from "../acp/session/permissionMemory";
import {
    type AcpUiBashDuration,
    type AcpUiVisibleTraceItem,
    normalizeBashDurations,
    normalizeThoughtDurations,
    normalizeVisibleTrace,
} from "../protocol/visibleTrace";

export const ACP_UI_SESSION_SCHEMA = "acpUi/session/1" as const;
export const ACP_UI_SESSION_FILE_SUFFIX = ".acp";

/** File name for a chat: `<sessionId>.acp`. The title stays in the file header. */
export function sessionFileNameForId(sessionId: string): string {
    return `${sessionId.trim()}${ACP_UI_SESSION_FILE_SUFFIX}`;
}

const maxUserMessageHistoryEntries = 55;

/** Serializes all mutations to one session file so concurrent writes do not race. */
const sessionFileWriteTails = new Map<string, Promise<unknown>>();

/**
 * Runs `operation` after prior writes to the same session file finish.
 */
export function enqueueSessionFileWrite<T>(
    sessionFileKey: string,
    operation: () => Promise<T>,
): Promise<T> {
    const prior = sessionFileWriteTails.get(sessionFileKey) ?? Promise.resolve();
    const next = prior.catch(() => undefined).then(() => operation());
    sessionFileWriteTails.set(sessionFileKey, next);
    return next as Promise<T>;
}

/**
 * Session metadata stored in every `.acp` file.
 */
export type AcpUiSessionMetadata = {
    schema: typeof ACP_UI_SESSION_SCHEMA;
    id: string;
    title: string;
    agentName?: string;
    runtimeSessionId?: string;
    createdAt: number;
    updatedAt: number;
};

/**
 * Editor-owned `.acp` document: session metadata plus composer user message history.
 */
export type AcpUiSessionDocument = AcpUiSessionMetadata & {
    history: string[];
    /** Last on-screen transcript, including UI-only fields such as durations. */
    cache?: AcpUiVisibleTraceItem[];
    /**
     * Client-measured thought times for the whole chat, in thought order.
     * Zero keeps alignment when that thought has no saved time.
     */
    thoughtDurations?: number[];
    /** Client-measured bash elapsed times for the whole chat, keyed by tool call id. */
    bashDurations?: AcpUiBashDuration[];
    /** Last model and config values, restored when the chat reconnects. */
    modelConfig?: AcpUiSessionModelConfig;
    /** Allow always and Reject always choices, restored when the chat reconnects. */
    permissionGrants?: PermissionGrant[];
};

/** One saved session config value (model, mode, or another agent option). */
export type AcpUiSessionModelConfigValue = {
    configId: string;
    value: string | boolean;
};

/** Last model configuration used in a chat. */
export type AcpUiSessionModelConfig = {
    modelId?: string;
    options: AcpUiSessionModelConfigValue[];
};

/** @deprecated Use {@link AcpUiSessionDocument}. */
export type AcpUiSessionHeader = AcpUiSessionDocument;

function metadataFromParsedValue(value: unknown): AcpUiSessionMetadata | null {
    if (value === null || typeof value !== "object") {
        return null;
    }
    const row = value as Record<string, unknown>;
    if (
        row.schema !== ACP_UI_SESSION_SCHEMA ||
        typeof row.id !== "string" ||
        row.id.length === 0 ||
        typeof row.title !== "string" ||
        row.title.trim().length === 0 ||
        typeof row.createdAt !== "number" ||
        !Number.isFinite(row.createdAt) ||
        typeof row.updatedAt !== "number" ||
        !Number.isFinite(row.updatedAt)
    ) {
        return null;
    }
    const agentName =
        typeof row.agentName === "string" && row.agentName.length > 0 ? row.agentName : undefined;
    const runtimeSessionId =
        typeof row.runtimeSessionId === "string" && row.runtimeSessionId.length > 0
            ? row.runtimeSessionId
            : undefined;
    return {
        schema: ACP_UI_SESSION_SCHEMA,
        id: row.id,
        title: row.title.trim(),
        ...(agentName !== undefined ? { agentName } : {}),
        ...(runtimeSessionId !== undefined ? { runtimeSessionId } : {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/**
 * Normalizes composer user message history lines.
 */
export function normalizeUserMessageHistory(entries: unknown): string[] {
    if (!Array.isArray(entries)) {
        return [];
    }
    const out: string[] = [];
    for (const item of entries) {
        if (typeof item === "string" && item.length > 0) {
            out.push(item);
        } else if (
            item !== null &&
            typeof item === "object" &&
            (item as Record<string, unknown>).type === "submit" &&
            typeof (item as Record<string, unknown>).body === "string"
        ) {
            const body = (item as Record<string, unknown>).body as string;
            if (body.length > 0) {
                out.push(body);
            }
        }
        if (out.length >= maxUserMessageHistoryEntries) {
            break;
        }
    }
    return out;
}

const derivedConfigPrefix = "_derived:";

/** Drops empty and derived-only config snapshots. */
export function normalizeSessionModelConfig(value: unknown): AcpUiSessionModelConfig | undefined {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }
    const row = value as Record<string, unknown>;
    const modelId =
        typeof row.modelId === "string" && row.modelId.trim().length > 0
            ? row.modelId.trim()
            : undefined;
    const options: AcpUiSessionModelConfigValue[] = [];
    if (Array.isArray(row.options)) {
        for (const item of row.options) {
            if (item === null || typeof item !== "object") {
                continue;
            }
            const entry = item as Record<string, unknown>;
            if (typeof entry.configId !== "string" || entry.configId.length === 0) {
                continue;
            }
            if (entry.configId.startsWith(derivedConfigPrefix)) {
                continue;
            }
            if (typeof entry.value !== "string" && typeof entry.value !== "boolean") {
                continue;
            }
            options.push({ configId: entry.configId, value: entry.value });
        }
    }
    if (modelId === undefined && options.length === 0) {
        return undefined;
    }
    return {
        ...(modelId !== undefined ? { modelId } : {}),
        options,
    };
}

type ModelConfigOption = {
    configId: string;
    type: "select" | "boolean";
    category?: string;
    currentValue: string | boolean;
    options?: ReadonlyArray<{ value: string }>;
};

/** Current values from a live config-option list, omitting derived composer controls. */
export function modelConfigFromSessionOptions(
    options: readonly ModelConfigOption[],
): AcpUiSessionModelConfig | undefined {
    const stored = options.filter((option) => !option.configId.startsWith(derivedConfigPrefix));
    const model = stored.find(
        (option) =>
            option.type === "select" &&
            option.category === "model" &&
            typeof option.currentValue === "string",
    );
    return normalizeSessionModelConfig({
        ...(model !== undefined && typeof model.currentValue === "string"
            ? { modelId: model.currentValue }
            : {}),
        options: stored.map((option) => ({
            configId: option.configId,
            value: option.currentValue,
        })),
    });
}

/** Overlays a saved model configuration onto advertised options. */
export function applySavedModelConfig<T extends ModelConfigOption>(
    options: readonly T[],
    saved: AcpUiSessionModelConfig,
): T[] {
    const byId = new Map(saved.options.map((option) => [option.configId, option.value]));
    return options.map((option) => {
        if (
            option.type === "select" &&
            option.category === "model" &&
            saved.modelId !== undefined &&
            saved.modelId.length > 0
        ) {
            return { ...option, currentValue: saved.modelId };
        }
        const value = byId.get(option.configId);
        if (option.type === "boolean" && typeof value === "boolean") {
            return { ...option, currentValue: value };
        }
        if (
            option.type === "select" &&
            typeof value === "string" &&
            (option.options ?? []).some((choice) => choice.value === value)
        ) {
            return { ...option, currentValue: value };
        }
        return option;
    });
}

function documentFromParsedValue(value: unknown): AcpUiSessionDocument | null {
    const metadata = metadataFromParsedValue(value);
    if (metadata === null || value === null || typeof value !== "object") {
        return null;
    }
    const row = value as Record<string, unknown>;
    const cache = normalizeVisibleTrace(row.cache);
    const thoughtDurations = normalizeThoughtDurations(row.thoughtDurations);
    const bashDurations = normalizeBashDurations(row.bashDurations);
    const modelConfig = normalizeSessionModelConfig(row.modelConfig);
    const permissionGrants = normalizePermissionGrants(row.permissionGrants);
    return {
        ...metadata,
        history: userMessageHistoryFromRow(row),
        ...(cache.length > 0 ? { cache } : {}),
        ...(thoughtDurations.length > 0 ? { thoughtDurations } : {}),
        ...(bashDurations.length > 0 ? { bashDurations } : {}),
        ...(modelConfig !== undefined ? { modelConfig } : {}),
        ...(permissionGrants.length > 0 ? { permissionGrants } : {}),
    };
}

function userMessageHistoryFromRow(row: Record<string, unknown>): string[] {
    const fromLegacyPrompt = normalizeUserMessageHistory(row.promptHistory);
    if (fromLegacyPrompt.length > 0) {
        return fromLegacyPrompt;
    }
    if ("history" in row) {
        return normalizeUserMessageHistory(row.history);
    }
    return [];
}

/**
 * Serializes a session document as pretty-printed JSON.
 */
export function serializeSessionDocument(document: AcpUiSessionDocument): string {
    return `${JSON.stringify(document, null, 2)}\n`;
}

/**
 * Parses a session document from pretty-printed JSON.
 */
export function parseSessionDocument(text: string): AcpUiSessionDocument | null {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return null;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        return null;
    }
    if (parsed === null || typeof parsed !== "object") {
        return null;
    }
    return documentFromParsedValue(parsed);
}

/**
 * Parses a full session file into a document.
 */
export function parseSessionFile(text: string): {
    header: AcpUiSessionDocument | null;
} {
    const document = parseSessionDocument(text);
    return { header: document };
}

/**
 * Parses the session header block (full document for the current format).
 */
export function parseSessionHeaderBlock(text: string): {
    header: AcpUiSessionDocument;
    consumedLines: number;
} | null {
    const document = parseSessionDocument(text);
    if (document === null) {
        return null;
    }
    return {
        header: document,
        consumedLines: text.split(/\r?\n/).length,
    };
}

/**
 * Parses the session header from a single JSON line (legacy).
 */
export function parseSessionHeaderLine(line: string): AcpUiSessionDocument | null {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("// ")) {
        return null;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        return null;
    }
    return documentFromParsedValue(parsed);
}

/**
 * True when chat open should wait for ACP `session/load` before showing transcript.
 */
export function shouldDeferJsonlHistoryReplay(header: { runtimeSessionId?: string }): boolean {
    const runtimeSessionId = header.runtimeSessionId?.trim();
    return runtimeSessionId !== undefined && runtimeSessionId.length > 0;
}
