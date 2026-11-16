import type * as acp from "@agentclientprotocol/sdk";
import { parseModelIdBracketParams } from "./modelVariantPicker";
import type { AcpUiSessionConfigState } from "./sessionConfigOptions";
import type { AcpUiSessionModelSelection } from "./sessionModels";

const CONTEXT_CONFIG_IDS = new Set(["context", "context_size"]);

const DEFAULT_CONTEXT_BY_MODEL_PREFIX: ReadonlyArray<{ prefix: string; tokens: number }> = [
    { prefix: "composer", tokens: 200_000 },
    { prefix: "claude", tokens: 200_000 },
    { prefix: "gpt-5", tokens: 272_000 },
    { prefix: "gpt", tokens: 128_000 },
];

/** Parses ACP config labels such as `200k`, `1m`, or `272K` into a token count. */
export function parseContextSizeLabel(value: string): number | null {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length === 0) {
        return null;
    }
    const match = /^(\d+(?:\.\d+)?)\s*([km])?$/.exec(trimmed);
    if (match === null) {
        return null;
    }
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }
    const unit = match[2];
    if (unit === "m") {
        return Math.round(amount * 1_000_000);
    }
    if (unit === "k") {
        return Math.round(amount * 1_000);
    }
    return Math.round(amount);
}

function contextFromRecord(params: Record<string, string>): number | null {
    const raw = params.context;
    if (raw === undefined || raw.length === 0) {
        return null;
    }
    return parseContextSizeLabel(raw);
}

function contextFromConfigOptions(state: AcpUiSessionConfigState | null): number | null {
    if (state === null) {
        return null;
    }
    for (const option of state.options) {
        if (option.type !== "select") {
            continue;
        }
        const id = option.configId.toLowerCase();
        if (!CONTEXT_CONFIG_IDS.has(id) && !id.endsWith(":context")) {
            continue;
        }
        const parsed = parseContextSizeLabel(option.currentValue);
        if (parsed !== null) {
            return parsed;
        }
    }
    return null;
}

function defaultContextForModelId(modelId: string): number | null {
    const base = parseModelIdBracketParams(modelId).base.toLowerCase();
    for (const entry of DEFAULT_CONTEXT_BY_MODEL_PREFIX) {
        if (base === entry.prefix || base.startsWith(`${entry.prefix}-`)) {
            return entry.tokens;
        }
    }
    return null;
}

/**
 * Best-effort context window size for the active session.
 * Cursor ACP does not emit `usage_update`; infer the window from model config instead.
 */
export function inferContextWindowSizeTokens(
    modelSelection: AcpUiSessionModelSelection | null,
    configOptions: AcpUiSessionConfigState | null,
): number | null {
    const fromConfig = contextFromConfigOptions(configOptions);
    if (fromConfig !== null) {
        return fromConfig;
    }
    const modelId = modelSelection?.currentModelId;
    if (modelId === undefined || modelId.length === 0) {
        return null;
    }
    const fromModelParams = contextFromRecord(parseModelIdBracketParams(modelId).params);
    if (fromModelParams !== null) {
        return fromModelParams;
    }
    return defaultContextForModelId(modelId);
}

/** Token count from an unstable `session/prompt` usage payload when the agent exposes it. */
export function promptTurnTokenCount(usage: acp.Usage | null | undefined): number | null {
    if (usage === null || usage === undefined) {
        return null;
    }
    if (Number.isFinite(usage.totalTokens) && usage.totalTokens > 0) {
        return usage.totalTokens;
    }
    const input = Number.isFinite(usage.inputTokens) ? usage.inputTokens : 0;
    const output = Number.isFinite(usage.outputTokens) ? usage.outputTokens : 0;
    const thought =
        usage.thoughtTokens !== null && usage.thoughtTokens !== undefined ? usage.thoughtTokens : 0;
    const total = input + output + thought;
    return total > 0 ? total : null;
}
