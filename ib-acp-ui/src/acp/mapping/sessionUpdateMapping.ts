import type * as acp from "@agentclientprotocol/sdk";
import type {
    ExtensionToWebviewMessage,
    SubagentActivityEvent,
    SubagentWorkState,
    ToolCallDiffRow,
    ToolCallStatus,
} from "../../protocol/extensionHostMessages";
import { positiveDurationMs } from "../../protocol/visibleTrace";
import { sessionConfigOptionsFromAgent } from "../session/sessionConfigOptions";
import { normalizeSlashCommand } from "../slashCommandMetadata";
import { canonicalToolCallId } from "./canonicalToolCallId";
import {
    taskDurationMsFromRawOutput,
    taskOutputIsBackground,
    taskToolFieldsFromRaw,
    type TaskToolFields,
} from "./taskToolPresentation";
import {
    computeToolCallDiffRows,
    previewDiffRows,
    windowToolCallDiffRows,
} from "./toolCallDiffLines";

function durationMsFromUpdatePayload(value: unknown): number | undefined {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }
    const record = value as Record<string, unknown>;
    const top = positiveDurationMs(record.durationMs) ?? positiveDurationMs(record.duration_ms);
    if (top !== undefined) {
        return top;
    }
    const meta = record._meta;
    if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
        return undefined;
    }
    const metaRecord = meta as Record<string, unknown>;
    return positiveDurationMs(metaRecord.durationMs) ?? positiveDurationMs(metaRecord.duration_ms);
}

const maxToolDisplayChars = 120_000;

function lineCountForToolSummary(text: string): number {
    if (text === "") {
        return 0;
    }
    let normalized = text;
    if (normalized.endsWith("\n")) {
        normalized = normalized.slice(0, -1);
    }
    if (normalized === "") {
        return 0;
    }
    return normalized.split("\n").length;
}

function clipToolDisplayText(text: string): string {
    if (text.length <= maxToolDisplayChars) {
        return text;
    }
    return `${text.slice(0, maxToolDisplayChars)}\n\n... (truncated for display)`;
}

function formatContentBlockForTool(block: acp.ContentBlock): string | undefined {
    if (block.type === "text") {
        const t = block.text.trim();
        return t.length > 0 ? t : undefined;
    }
    return `[${block.type}]`;
}

function formatDiffPieceAsFullText(piece: acp.ToolCallContent & { type: "diff" }): string {
    const pathLabel = piece.path.trim();
    const oldRaw = piece.oldText;
    const newText = piece.newText ?? "";
    const oldText = oldRaw ?? "";
    const isNewFile = oldRaw === null || oldRaw === undefined;
    const oldLineCount = lineCountForToolSummary(oldText);
    const newLineCount = lineCountForToolSummary(newText);
    const summary = isNewFile
        ? `new file (${newLineCount} line(s))`
        : `${oldLineCount} line(s) before -> ${newLineCount} line(s) after`;
    const oldDisplay = oldText.replace(/\r\n/g, "\n").trimEnd();
    const newDisplay = newText.replace(/\r\n/g, "\n").trimEnd();
    const body = `${pathLabel}\n${summary}\n\n--- previous ---\n${oldDisplay}\n\n--- proposed ---\n${newDisplay}`;
    return clipToolDisplayText(body);
}

function formatDiffSummaryOnly(piece: acp.ToolCallContent & { type: "diff" }): string {
    const pathLabel = piece.path.trim();
    const oldRaw = piece.oldText;
    const newText = piece.newText ?? "";
    const oldText = oldRaw ?? "";
    const isNewFile = oldRaw === null || oldRaw === undefined;
    const oldLineCount = lineCountForToolSummary(oldText);
    const newLineCount = lineCountForToolSummary(newText);
    const summary = isNewFile
        ? `new file (${newLineCount} line(s))`
        : `${oldLineCount} line(s) before -> ${newLineCount} line(s) after`;
    return `${pathLabel}\n${summary}`;
}

function commandSubtitleFromBacktickTitle(title: string): string | undefined {
    const t = title.trim();
    if (t.length >= 2 && t.startsWith("`") && t.endsWith("`")) {
        const inner = t.slice(1, -1).trim();
        return inner.length > 0 ? inner : undefined;
    }
    return undefined;
}

/**
 * Resolves a one-line shell command for execute/terminal tools from structured input, output, or Cursor-style backtick titles.
 */
export function toolCallExecuteCommandSubtitle(call: {
    title?: string | null;
    kind?: string | null;
    rawInput?: unknown;
    rawOutput?: unknown;
}): string | undefined {
    const kindStr =
        call.kind !== undefined && call.kind !== null && String(call.kind).length > 0
            ? String(call.kind)
            : "";
    const isExecute = kindStr === "execute" || kindStr === "terminal";
    const fromInput = extractShellCommandLine(call.rawInput);
    if (fromInput !== undefined) {
        return fromInput;
    }
    if (isExecute) {
        const fromOutput = extractShellCommandLine(call.rawOutput);
        if (fromOutput !== undefined) {
            return fromOutput;
        }
        if (typeof call.title === "string") {
            const fromTitle = commandSubtitleFromBacktickTitle(call.title);
            if (fromTitle !== undefined) {
                return fromTitle;
            }
        }
    }
    return undefined;
}

/**
 * Webview messages for a pending `session/request_permission`: dialog plus optional tool row update
 * (diff preview, content, subtitle) from the permission `toolCall`.
 */
function permissionToolTitle(toolCall: { title?: string | null; kind?: string | null }): string {
    const title = typeof toolCall.title === "string" ? toolCall.title.trim() : "";
    if (title.length > 0) {
        return title;
    }
    const kind =
        toolCall.kind !== undefined && toolCall.kind !== null
            ? String(toolCall.kind).toLowerCase()
            : "";
    return kind === "edit" ? "Write File" : "Tool";
}

function permissionSummary(
    content: string | undefined,
    detail: string | undefined,
): string | undefined {
    if (content === undefined) {
        return undefined;
    }
    let text = content.trim();
    if (text.length === 0) {
        return undefined;
    }
    if (detail !== undefined && detail.length > 0) {
        if (text === detail) {
            return undefined;
        }
        if (text.startsWith(`${detail}\n`)) {
            text = text.slice(detail.length).trim();
        }
    }
    if (text.length === 0) {
        return undefined;
    }
    const lines = text.split("\n").slice(0, 6).join("\n");
    if (lines.length <= 400) {
        return lines;
    }
    return `${lines.slice(0, 400).trimEnd()}…`;
}

export function extensionMessagesForPermissionRequest(
    requestId: string,
    params: acp.RequestPermissionRequest,
): ExtensionToWebviewMessage[] {
    const toolCall = params.toolCall;
    const parts = toolCallUpdateToDisplayParts(toolCall);
    const commandSubtitle = toolCallExecuteCommandSubtitle(toolCall);
    const pathOrSearchSubtitle = toolCallUpdateSubtitleHint(toolCall);
    const subtitle =
        commandSubtitle ??
        (pathOrSearchSubtitle !== undefined && pathOrSearchSubtitle.trim().length > 0
            ? pathOrSearchSubtitle.trim()
            : undefined);
    const cwd = shellWorkingDirectory(toolCall);
    const summary = permissionSummary(parts.contentText, subtitle);
    const previewRows =
        parts.diffRows !== undefined && parts.diffRows.length > 0
            ? previewDiffRows(windowToolCallDiffRows(parts.diffRows), 12)
            : [];
    const messages: ExtensionToWebviewMessage[] = [
        {
            type: "permissionRequest",
            requestId,
            toolTitle: permissionToolTitle(toolCall),
            ...(subtitle !== undefined ? { detail: subtitle } : {}),
            ...(summary !== undefined ? { summary } : {}),
            ...(previewRows.length > 0 ? { diffRows: previewRows } : {}),
            options: params.options.map((o) => ({
                optionId: o.optionId,
                name: o.name,
            })),
        },
    ];
    const rawToolCallId = typeof toolCall.toolCallId === "string" ? toolCall.toolCallId.trim() : "";
    if (rawToolCallId.length === 0) {
        return messages;
    }
    const toolCallId = canonicalToolCallId(rawToolCallId);
    const kindFromUpdate =
        toolCall.kind !== undefined && toolCall.kind !== null && String(toolCall.kind).length > 0
            ? String(toolCall.kind)
            : undefined;
    const rawStatus = toolCall.status;
    const status: ToolCallStatus =
        rawStatus === "failed" ||
        rawStatus === "completed" ||
        rawStatus === "in_progress" ||
        rawStatus === "pending"
            ? rawStatus
            : "pending";
    const hasDiffRows = parts.diffRows !== undefined && parts.diffRows.length > 0;
    const hasContent = parts.contentText !== undefined && parts.contentText.trim().length > 0;
    if (hasDiffRows || hasContent || subtitle !== undefined || kindFromUpdate !== undefined) {
        messages.push({
            type: "updateToolCall",
            toolCallId,
            status,
            ...(kindFromUpdate !== undefined ? { kind: kindFromUpdate } : {}),
            ...(parts.contentText !== undefined ? { content: parts.contentText } : {}),
            ...(hasDiffRows ? { diffRows: parts.diffRows } : {}),
            ...(subtitle !== undefined ? { subtitle } : {}),
            ...(cwd !== undefined ? { cwd } : {}),
        });
    }
    return messages;
}

function trimmedPath(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

const shellCwdKeys = ["working_directory", "workingDirectory", "cwd", "workdir"] as const;

function shellCwdFromRecord(record: Record<string, unknown>, depth: number): string | undefined {
    for (const key of shellCwdKeys) {
        const cwd = trimmedPath(record[key]);
        if (cwd !== undefined) {
            return cwd;
        }
    }
    if (depth <= 0) {
        return undefined;
    }
    const nested = record._meta;
    if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
        return shellCwdFromRecord(nested as Record<string, unknown>, depth - 1);
    }
    return undefined;
}

function shellCwdFromRaw(raw: unknown): string | undefined {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return undefined;
    }
    return shellCwdFromRecord(raw as Record<string, unknown>, 1);
}

function isShellKind(kind: string | null | undefined): boolean {
    return kind === "execute" || kind === "terminal";
}

/** Working directory for a bash tool, from raw input or the first location. */
function shellWorkingDirectory(
    call: {
        kind?: string | null;
        rawInput?: unknown;
        rawOutput?: unknown;
        locations?: ReadonlyArray<{ path?: string | null }> | null;
    },
    pendingKind?: string,
): string | undefined {
    const kind =
        call.kind !== undefined && call.kind !== null && String(call.kind).length > 0
            ? String(call.kind)
            : pendingKind;
    const fromRaw = shellCwdFromRaw(call.rawInput) ?? shellCwdFromRaw(call.rawOutput);
    if (
        fromRaw !== undefined &&
        (isShellKind(kind) || extractShellCommandLine(call.rawInput) !== undefined)
    ) {
        return fromRaw;
    }
    if (!isShellKind(kind)) {
        return undefined;
    }
    return trimmedPath(call.locations?.[0]?.path);
}

function extractShellCommandLine(raw: unknown): string | undefined {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    if (typeof raw === "string") {
        const t = raw.trim();
        return t.length > 0 ? t : undefined;
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
        return undefined;
    }
    const record = raw as Record<string, unknown>;
    const directKeys = [
        "command",
        "cmd",
        "shellCommand",
        "shell_command",
        "bashCommand",
        "script",
        "line",
    ] as const;
    for (const key of directKeys) {
        const v = record[key];
        if (typeof v === "string" && v.trim().length > 0) {
            return v.trim();
        }
    }
    if (Array.isArray(record.argv) && record.argv.length > 0) {
        const parts = record.argv
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim());
        if (parts.length > 0) {
            return parts.join(" ");
        }
    }
    if (typeof record.program === "string" && record.program.trim().length > 0) {
        const prog = record.program.trim();
        const args = Array.isArray(record.args)
            ? record.args.filter((x): x is string => typeof x === "string")
            : [];
        return args.length > 0 ? `${prog} ${args.join(" ")}` : prog;
    }
    return undefined;
}

function commandLineHintForToolUpdate(update: acp.ToolCallUpdate): string | undefined {
    const fromInput = extractShellCommandLine(update.rawInput);
    if (fromInput !== undefined) {
        return fromInput;
    }
    return extractShellCommandLine(update.rawOutput);
}

function formatToolCallContentPiece(
    piece: acp.ToolCallContent,
    update: acp.ToolCallUpdate,
): string | undefined {
    if (piece.type === "diff") {
        return formatDiffPieceAsFullText(piece);
    }
    if (piece.type === "terminal") {
        const id = piece.terminalId.trim();
        const cmd = commandLineHintForToolUpdate(update);
        const lines: string[] = [];
        if (cmd !== undefined && cmd.length > 0) {
            lines.push(`$ ${cmd}`);
        }
        if (id.length > 0) {
            lines.push(`Terminal: ${id}`);
        }
        const joined = lines.filter((l) => l.length > 0).join("\n");
        return joined.length > 0 ? joined : id.length > 0 ? `[Terminal ${id}]` : "[Terminal]";
    }
    if (piece.type === "content") {
        return formatContentBlockForTool(piece.content);
    }
    return undefined;
}

function formatRawToolOutput(raw: unknown): string | undefined {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    if (typeof raw === "string") {
        const t = raw.trim();
        return t.length > 0 ? clipToolDisplayText(t) : undefined;
    }
    if (typeof raw === "object") {
        const record = raw as Record<string, unknown>;
        if (typeof record.content === "string") {
            const t = record.content.trim();
            return t.length > 0 ? clipToolDisplayText(t) : undefined;
        }
        if (typeof record.stdout === "string" || typeof record.stderr === "string") {
            let combined = "";
            if (typeof record.exitCode === "number" && record.exitCode !== 0) {
                combined += `exit ${record.exitCode}\n`;
            }
            if (typeof record.stdout === "string" && record.stdout.length > 0) {
                combined += record.stdout;
            }
            if (typeof record.stderr === "string" && record.stderr.length > 0) {
                if (combined.length > 0 && !combined.endsWith("\n")) {
                    combined += "\n";
                }
                combined += record.stderr;
            }
            const t = combined.trim();
            return t.length > 0 ? clipToolDisplayText(t) : undefined;
        }
        if (
            typeof record.totalMatches === "number" ||
            typeof record.totalFiles === "number" ||
            typeof record.resultCount === "number"
        ) {
            return formatSearchMatchLines(record);
        }
        try {
            return clipToolDisplayText(JSON.stringify(raw, null, 2));
        } catch {
            return undefined;
        }
    }
    if (typeof raw === "number" || typeof raw === "boolean" || typeof raw === "bigint") {
        return clipToolDisplayText(String(raw));
    }
    if (typeof raw === "symbol") {
        return clipToolDisplayText(raw.toString());
    }
    return undefined;
}

function toolCallUpdateToDisplayParts(update: acp.ToolCallUpdate): {
    contentText: string | undefined;
    diffRows: ToolCallDiffRow[] | undefined;
} {
    let diffRows: ToolCallDiffRow[] | undefined;
    const segments: string[] = [];
    let hadTerminalPiece = false;
    if (update.content !== undefined && update.content !== null && update.content.length > 0) {
        for (const piece of update.content) {
            if (piece.type === "diff") {
                if (diffRows === undefined) {
                    const oldText = piece.oldText ?? "";
                    const newText = piece.newText ?? "";
                    diffRows = computeToolCallDiffRows(oldText, newText);
                    segments.push(formatDiffSummaryOnly(piece));
                } else {
                    const segment = formatDiffPieceAsFullText(piece);
                    if (segment.trim().length > 0) {
                        segments.push(segment.trim());
                    }
                }
                continue;
            }
            if (piece.type === "terminal") {
                hadTerminalPiece = true;
            }
            const segment = formatToolCallContentPiece(piece, update);
            if (segment !== undefined && segment.trim().length > 0) {
                segments.push(segment.trim());
            }
        }
    }
    if (segments.length > 0) {
        let contentText = clipToolDisplayText(segments.join("\n\n"));
        if (hadTerminalPiece) {
            const rawFormatted = formatRawToolOutput(update.rawOutput);
            if (rawFormatted !== undefined && rawFormatted.trim().length > 0) {
                contentText = clipToolDisplayText(`${contentText}\n\n${rawFormatted.trim()}`);
            }
        }
        return {
            contentText,
            diffRows,
        };
    }
    if (diffRows !== undefined && diffRows.length > 0) {
        return { contentText: undefined, diffRows };
    }
    return {
        contentText: formatRawToolOutput(update.rawOutput),
        diffRows: undefined,
    };
}

function firstToolCallTextPreview(call: acp.ToolCall): string | undefined {
    if (!call.content || call.content.length === 0) {
        return undefined;
    }
    for (const block of call.content) {
        if (block.type === "content" && block.content.type === "text") {
            const t = block.content.text.trim();
            if (t.length > 0) {
                return t;
            }
        }
    }
    return undefined;
}

function formatToolRawInput(raw: unknown): string | undefined {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    if (typeof raw === "string") {
        const t = raw.trim();
        return t.length > 0 ? t : undefined;
    }
    if (typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw as object).length === 0) {
        return undefined;
    }
    try {
        const s = JSON.stringify(raw);
        return s !== undefined && s !== "{}" && s !== "[]" ? s : undefined;
    } catch {
        return undefined;
    }
}

/** Tracks tool kinds from `tool_call` so `tool_call_update` can classify sparse completions (for example read tools with only `rawOutput.content`). */
export type ToolCallKindTracking = {
    kindByToolId: Map<string, string | undefined>;
    /** Cursor task tools, so a completion that only sends `rawOutput` does not replace the prompt with JSON. */
    taskByToolId: Map<string, TaskToolFields>;
};

/** Creates a fresh map for one prompt turn (tool IDs are unique per session but clearing each turn avoids unbounded growth). */
export function createToolCallKindTracking(): ToolCallKindTracking {
    return { kindByToolId: new Map(), taskByToolId: new Map() };
}

/**
 * Derives a subtitle for the tool row when a `tool_call_update` adds paths the initial `tool_call` omitted (common with Cursor CLI: empty `rawInput` on pending).
 */
function searchSubtitleFromRawInput(
    raw: unknown,
    update: acp.ToolCallUpdate,
    pendingKind: string | undefined,
): string | undefined {
    const pattern = patternHintFromStructuredUnknown(raw) ?? patternHintFromPlainObject(raw);
    const pathHint = pathHintFromStructuredUnknown(raw);
    if (pattern !== undefined && pathHint !== undefined) {
        return `"${pattern}" in ${pathHint}`;
    }
    if (pattern !== undefined) {
        return `"${pattern}"`;
    }
    if (pathHint !== undefined) {
        return formatSubtitlePathForKind(pathHint, update, pendingKind);
    }
    return undefined;
}

function patternHintFromStructuredUnknown(raw: unknown): string | undefined {
    const direct = patternHintFromPlainObject(raw);
    if (direct !== undefined) {
        return direct;
    }
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
        const record = raw as Record<string, unknown>;
        const nested = record._meta;
        if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
            return patternHintFromPlainObject(nested);
        }
    }
    return undefined;
}

export function toolCallUpdateSubtitleHint(
    update: acp.ToolCallUpdate,
    options?: { pendingKind?: string },
): string | undefined {
    return appendSearchStats(
        toolCallUpdateSubtitleBody(update, options),
        update,
        options?.pendingKind,
    );
}

function toolCallUpdateSubtitleBody(
    update: acp.ToolCallUpdate,
    options?: { pendingKind?: string },
): string | undefined {
    const task = taskToolFieldsFromRaw(update.rawInput);
    if (task !== undefined) {
        return task.subagentType.length > 0 ? task.subagentType : undefined;
    }
    const kind = effectiveToolKindForUpdate(update, options?.pendingKind);
    if (kind === "execute" || kind === "terminal") {
        const cmd =
            extractShellCommandLine(update.rawInput) ?? extractShellCommandLine(update.rawOutput);
        if (cmd !== undefined) {
            return cmd;
        }
    }
    if (update.locations && update.locations.length > 0) {
        const locPath = update.locations[0]!.path.trim();
        if (locPath.length > 0) {
            return locPath;
        }
    }
    if (update.content && update.content.length > 0) {
        for (const block of update.content) {
            if (block.type === "diff") {
                const pathLabel = block.path.trim();
                if (pathLabel.length > 0) {
                    return pathLabel;
                }
            }
        }
    }
    const fromRawInputSearch = searchSubtitleFromRawInput(
        update.rawInput,
        update,
        options?.pendingKind,
    );
    if (fromRawInputSearch !== undefined) {
        return fromRawInputSearch;
    }
    const fromRawOutputPath = pathHintFromStructuredUnknown(update.rawOutput);
    if (fromRawOutputPath !== undefined) {
        return formatSubtitlePathForKind(fromRawOutputPath, update, options?.pendingKind);
    }
    const fromRawOutputError = pathHintFromErrorField(update.rawOutput);
    if (fromRawOutputError !== undefined) {
        return formatSubtitlePathForKind(fromRawOutputError, update, options?.pendingKind);
    }
    const fromRawInputPath = pathHintFromStructuredUnknown(update.rawInput);
    if (fromRawInputPath !== undefined) {
        return formatSubtitlePathForKind(fromRawInputPath, update, options?.pendingKind);
    }
    const rawInputText = formatToolRawInput(update.rawInput);
    if (rawInputText !== undefined && rawInputText.trim().length > 0) {
        const fromJsonPath = pathHintFromJsonishRawInput(rawInputText);
        if (fromJsonPath !== undefined) {
            return formatSubtitlePathForKind(fromJsonPath, update, options?.pendingKind);
        }
    }
    if (kind === "search" || kind === "grep" || kind === "glob") {
        const stats = searchStatsSubtitleFromRawOutput(update.rawOutput);
        if (stats !== undefined) {
            return stats;
        }
    }
    return undefined;
}

function pathHintFromStructuredUnknown(raw: unknown): string | undefined {
    const direct = pathHintFromPlainObject(raw);
    if (direct !== undefined) {
        return direct;
    }
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
        const record = raw as Record<string, unknown>;
        const nested = record._meta;
        if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
            return pathHintFromPlainObject(nested);
        }
    }
    return undefined;
}

function pathHintFromPlainObject(raw: unknown): string | undefined {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return undefined;
    }
    const record = raw as Record<string, unknown>;
    for (const key of [
        "path",
        "filePath",
        "relativePath",
        "file",
        "target",
        "target_directory",
        "targetDirectory",
        "cwd",
        "root",
    ] as const) {
        const value = record[key];
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.length > 0) {
                return trimmed;
            }
        }
    }
    return undefined;
}

function patternHintFromPlainObject(raw: unknown): string | undefined {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return undefined;
    }
    const record = raw as Record<string, unknown>;
    for (const key of [
        "pattern",
        "query",
        "search",
        "glob",
        "glob_pattern",
        "globPattern",
        "include",
    ] as const) {
        const value = record[key];
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.length > 0) {
                return trimmed;
            }
        }
    }
    return undefined;
}

function pathHintFromErrorText(text: string): string | undefined {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    const pathDoesNotExist = trimmed.match(/^Path does not exist:\s*(.+)$/i)?.[1];
    if (pathDoesNotExist !== undefined && pathDoesNotExist.length > 0) {
        return pathDoesNotExist.trim();
    }
    return undefined;
}

function pathHintFromErrorField(raw: unknown): string | undefined {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return undefined;
    }
    const record = raw as Record<string, unknown>;
    if (typeof record.error === "string") {
        return pathHintFromErrorText(record.error);
    }
    return undefined;
}

/** Turns structured grep hits into `file:line: text` lines. A count-only payload stays on the summary. */
function formatSearchMatchLines(record: Record<string, unknown>): string | undefined {
    const list = record.matches ?? record.results ?? record.files;
    if (!Array.isArray(list) || list.length === 0) {
        return undefined;
    }
    const lines: string[] = [];
    for (const entry of list) {
        if (typeof entry === "string") {
            const trimmed = entry.trim();
            if (trimmed.length > 0) {
                lines.push(trimmed);
            }
            continue;
        }
        if (entry === null || typeof entry !== "object") {
            continue;
        }
        const row = entry as Record<string, unknown>;
        const file =
            typeof row.file === "string"
                ? row.file.trim()
                : typeof row.path === "string"
                  ? row.path.trim()
                  : "";
        const lineNumber =
            typeof row.line === "number"
                ? String(row.line)
                : typeof row.lineNumber === "number"
                  ? String(row.lineNumber)
                  : "";
        const text =
            typeof row.text === "string"
                ? row.text.trim()
                : typeof row.content === "string"
                  ? row.content.trim()
                  : "";
        if (file.length > 0 && lineNumber.length > 0 && text.length > 0) {
            lines.push(`${file}:${lineNumber}: ${text}`);
            continue;
        }
        if (file.length > 0 && text.length > 0) {
            lines.push(`${file}: ${text}`);
            continue;
        }
        if (file.length > 0) {
            lines.push(file);
        }
    }
    if (lines.length === 0) {
        return undefined;
    }
    return clipToolDisplayText(lines.join("\n"));
}

function isBareSearchCount(text: string): boolean {
    return /^\d+\s+(?:matches|match|files|file|results|result)$/i.test(text.trim());
}

function appendSearchStats(
    subtitle: string | undefined,
    update: acp.ToolCallUpdate,
    pendingKind: string | undefined,
): string | undefined {
    const kind = effectiveToolKindForUpdate(update, pendingKind);
    if (kind !== "search" && kind !== "grep" && kind !== "glob") {
        return subtitle;
    }
    const stats = searchStatsSubtitleFromRawOutput(update.rawOutput);
    if (stats === undefined) {
        return subtitle;
    }
    if (subtitle === undefined || subtitle.trim().length === 0 || isBareSearchCount(subtitle)) {
        return stats;
    }
    const trimmed = subtitle.trim();
    if (trimmed === stats || trimmed.endsWith(`· ${stats}`)) {
        return trimmed;
    }
    return `${trimmed} · ${stats}`;
}

/** Compact count label for Cursor-style search completions (`totalMatches` / `totalFiles`). */
export function searchStatsSubtitleFromRawOutput(raw: unknown): string | undefined {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return undefined;
    }
    const record = raw as Record<string, unknown>;
    if (typeof record.totalMatches === "number") {
        const count = record.totalMatches;
        return count === 1 ? "1 match" : `${count} matches`;
    }
    if (typeof record.totalFiles === "number") {
        const count = record.totalFiles;
        return count === 1 ? "1 file" : `${count} files`;
    }
    if (typeof record.resultCount === "number") {
        const count = record.resultCount;
        return count === 1 ? "1 result" : `${count} results`;
    }
    return undefined;
}

function pathHintFromJsonishRawInput(text: string): string | undefined {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) {
        return undefined;
    }
    try {
        const parsed = JSON.parse(trimmed) as unknown;
        return pathHintFromPlainObject(parsed);
    } catch {
        return undefined;
    }
}

function effectiveToolKindForUpdate(
    update: acp.ToolCallUpdate,
    pendingKind: string | undefined,
): string | undefined {
    if (update.kind !== undefined && update.kind !== null && String(update.kind).length > 0) {
        return update.kind;
    }
    return pendingKind;
}

function formatSubtitlePathForKind(
    pathHint: string,
    update: acp.ToolCallUpdate,
    pendingKind: string | undefined,
): string | undefined {
    const kind = effectiveToolKindForUpdate(update, pendingKind);
    const status = update.status ?? "completed";
    if (kind === "read" && status === "completed") {
        return fileNameFromPath(pathHint);
    }
    return pathHint;
}

function fileNameFromPath(pathText: string): string {
    const trimmed = pathText.trim();
    const normalized = trimmed.replace(/\\/g, "/");
    const slash = normalized.lastIndexOf("/");
    if (slash >= 0 && slash < normalized.length - 1) {
        return normalized.slice(slash + 1);
    }
    return trimmed;
}

/**
 * Builds the dim subtitle line for a tool call (paths, arguments, or inline text from the agent).
 */
export function toolCallSubtitleFromToolCall(call: acp.ToolCall): string | undefined {
    const task = taskToolFieldsFromRaw(call.rawInput);
    if (task !== undefined) {
        return task.subagentType.length > 0 ? task.subagentType : undefined;
    }
    const execLine = toolCallExecuteCommandSubtitle(call);
    if (execLine !== undefined) {
        return execLine;
    }
    const kindStr = call.kind !== undefined && call.kind !== null ? String(call.kind) : "";
    if (kindStr === "execute" || kindStr === "terminal") {
        if (call.locations && call.locations.length > 0) {
            const locPath = call.locations[0]!.path.trim();
            if (locPath.length > 0) {
                return locPath;
            }
        }
        return formatToolRawInput(call.rawInput);
    }
    const fromRawInputSearch = searchSubtitleFromRawInput(
        call.rawInput,
        call,
        kindStr.length > 0 ? kindStr : undefined,
    );
    if (fromRawInputSearch !== undefined) {
        return fromRawInputSearch;
    }
    const fromContent = firstToolCallTextPreview(call);
    if (fromContent !== undefined) {
        return fromContent;
    }
    if (call.locations && call.locations.length > 0) {
        const locPath = call.locations[0]!.path.trim();
        if (locPath.length > 0) {
            return locPath;
        }
    }
    const fromRawInputPath = pathHintFromStructuredUnknown(call.rawInput);
    if (fromRawInputPath !== undefined) {
        return formatSubtitlePathForKind(
            fromRawInputPath,
            call,
            kindStr.length > 0 ? kindStr : undefined,
        );
    }
    return formatToolRawInput(call.rawInput);
}

/**
 * Maps a single ACP session/update payload to zero or more webview protocol messages.
 */
export function sessionUpdateToWebviewMessages(
    update: acp.SessionUpdate,
    toolKindTracking?: ToolCallKindTracking,
): ExtensionToWebviewMessage[] {
    switch (update.sessionUpdate) {
        case "agent_thought_chunk": {
            const thoughtUpdate = update as unknown as {
                content?: { type?: string; text?: string };
                text?: string;
            };
            const textFromBlock =
                thoughtUpdate.content?.type === "text" ? thoughtUpdate.content.text : undefined;
            const text = textFromBlock ?? thoughtUpdate.text ?? "";
            if (text.length === 0) {
                return [];
            }
            const durationMs = durationMsFromUpdatePayload(update);
            return [
                {
                    type: "appendAgentThought",
                    text,
                    ...(durationMs !== undefined ? { durationMs } : {}),
                },
            ];
        }
        case "agent_message_chunk": {
            const block = update.content;
            if (block.type === "text") {
                return [{ type: "appendAgentText", text: block.text }];
            }
            return [];
        }
        case "user_message_chunk": {
            const block = update.content;
            if (block.type === "text") {
                return [{ type: "appendUserText", text: block.text }];
            }
            if (
                block.type === "image" &&
                block.data.length > 0 &&
                block.mimeType.startsWith("image/")
            ) {
                return [
                    {
                        type: "appendUserImage",
                        image: { data: block.data, mimeType: block.mimeType },
                    },
                ];
            }
            return [];
        }
        case "tool_call": {
            const toolCallId = canonicalToolCallId(update.toolCallId);
            toolKindTracking?.kindByToolId.set(toolCallId, update.kind);
            const task = taskToolFieldsFromRaw(update.rawInput);
            if (task !== undefined) {
                toolKindTracking?.taskByToolId.set(toolCallId, task);
            }
            const subtitle =
                task !== undefined
                    ? task.subagentType.length > 0
                        ? task.subagentType
                        : undefined
                    : toolCallSubtitleFromToolCall(update);
            const cwd = task !== undefined ? undefined : shellWorkingDirectory(update);
            const durationMs = durationMsFromUpdatePayload(update);
            const prompt = task !== undefined ? clipToolDisplayText(task.prompt).trim() : "";
            return withSessionLinks(toolCallId, update.content, [
                {
                    type: "appendToolCall",
                    toolCallId,
                    title: update.title,
                    kind: update.kind,
                    status: update.status ?? undefined,
                    ...(subtitle !== undefined ? { subtitle } : {}),
                    ...(cwd !== undefined ? { cwd } : {}),
                    ...(prompt.length > 0 ? { content: prompt } : {}),
                    ...(durationMs !== undefined ? { durationMs } : {}),
                },
            ]);
        }
        case "tool_call_update": {
            const toolCallId = canonicalToolCallId(update.toolCallId);
            const incomingTask = taskToolFieldsFromRaw(update.rawInput);
            if (incomingTask !== undefined) {
                toolKindTracking?.taskByToolId.set(toolCallId, incomingTask);
            }
            const task = incomingTask ?? toolKindTracking?.taskByToolId.get(toolCallId);
            if (task !== undefined) {
                const kindFromUpdate =
                    update.kind !== undefined &&
                    update.kind !== null &&
                    String(update.kind).length > 0
                        ? String(update.kind)
                        : undefined;
                if (kindFromUpdate !== undefined) {
                    toolKindTracking?.kindByToolId.set(toolCallId, kindFromUpdate);
                }
                const background =
                    taskOutputIsBackground(update.rawOutput) ||
                    String(update.status ?? "") === "disconnected";
                const durationMs = background
                    ? undefined
                    : (durationMsFromUpdatePayload(update) ??
                      taskDurationMsFromRawOutput(update.rawOutput));
                const subtitle = task.subagentType.length > 0 ? task.subagentType : undefined;
                const prompt =
                    incomingTask !== undefined ? clipToolDisplayText(task.prompt).trim() : "";
                const reported = update.status;
                const status = background
                    ? "in_progress"
                    : reported === "pending" ||
                        reported === "in_progress" ||
                        reported === "completed" ||
                        reported === "failed"
                      ? reported
                      : "completed";
                return withSessionLinks(toolCallId, update.content, [
                    {
                        type: "updateToolCall",
                        toolCallId,
                        status,
                        ...(kindFromUpdate !== undefined ? { kind: kindFromUpdate } : {}),
                        ...(prompt.length > 0 ? { content: prompt } : {}),
                        ...(subtitle !== undefined ? { subtitle } : {}),
                        ...(durationMs !== undefined ? { durationMs } : {}),
                    },
                ]);
            }
            const parts = toolCallUpdateToDisplayParts(update);
            const pendingKind = toolKindTracking?.kindByToolId.get(toolCallId);
            const subtitleHint = toolCallUpdateSubtitleHint(update, {
                pendingKind,
            });
            const cwd = shellWorkingDirectory(update, pendingKind);
            const kindFromUpdate =
                update.kind !== undefined && update.kind !== null && String(update.kind).length > 0
                    ? String(update.kind)
                    : undefined;
            if (kindFromUpdate !== undefined) {
                toolKindTracking?.kindByToolId.set(toolCallId, kindFromUpdate);
            }
            const durationMs = durationMsFromUpdatePayload(update);
            return withSessionLinks(toolCallId, update.content, [
                {
                    type: "updateToolCall",
                    toolCallId,
                    status: update.status ?? "completed",
                    ...(kindFromUpdate !== undefined ? { kind: kindFromUpdate } : {}),
                    ...(parts.contentText !== undefined ? { content: parts.contentText } : {}),
                    ...(parts.diffRows !== undefined && parts.diffRows.length > 0
                        ? { diffRows: parts.diffRows }
                        : {}),
                    ...(subtitleHint !== undefined ? { subtitle: subtitleHint } : {}),
                    ...(cwd !== undefined ? { cwd } : {}),
                    ...(durationMs !== undefined ? { durationMs } : {}),
                },
            ]);
        }
        case "available_commands_update": {
            const raw = update as unknown as { availableCommands?: unknown };
            const list = raw.availableCommands;
            if (!Array.isArray(list)) {
                return [];
            }
            const commands = list
                .map((entry) => {
                    if (entry === null || typeof entry !== "object") {
                        return null;
                    }
                    const o = entry as Record<string, unknown>;
                    const name = typeof o.name === "string" ? o.name.trim() : "";
                    const description =
                        typeof o.description === "string" ? o.description.trim() : "";
                    if (name.length === 0) {
                        return null;
                    }
                    let inputHint: string | undefined;
                    const input = o.input;
                    if (input !== null && typeof input === "object") {
                        const hint = (input as Record<string, unknown>).hint;
                        if (typeof hint === "string" && hint.trim().length > 0) {
                            inputHint = hint.trim();
                        }
                    }
                    const sourceCandidates = [o.source, o.scope, o.skillSource] as unknown[];
                    let source: string | undefined;
                    for (const candidate of sourceCandidates) {
                        if (typeof candidate === "string" && candidate.trim().length > 0) {
                            source = candidate.trim();
                            break;
                        }
                    }
                    return normalizeSlashCommand({
                        name,
                        description,
                        ...(inputHint !== undefined ? { inputHint } : {}),
                        ...(source !== undefined ? { source } : {}),
                    });
                })
                .filter((x): x is NonNullable<typeof x> => x !== null);
            return [{ type: "slashCommands", commands }];
        }
        case "plan":
            return [
                {
                    type: "appendPlan",
                    entries: update.entries.map((e) => ({
                        content: e.content,
                        status: e.status,
                        priority: e.priority,
                    })),
                },
            ];
        case "config_option_update": {
            const normalized = sessionConfigOptionsFromAgent(update.configOptions);
            if (normalized === null) {
                return [];
            }
            return [
                {
                    type: "sessionConfigOptions",
                    options: normalized.options,
                },
            ];
        }
        case "usage_update":
            return [{ type: "tokenUsage", used: update.used, size: update.size }];
        case "subagent_update":
            return [subagentUpdateMessage(update)];
        case "session_message":
        case "session_message_chunk":
            return sessionMessageTexts(update).map((text) => ({ type: "appendAgentText", text }));
        default:
            return [];
    }
}

function textFromContentBlock(block: acp.ContentBlock): string | undefined {
    if (block.type === "text" && block.text.length > 0) {
        return block.text;
    }
    return undefined;
}

type SessionMessageUpdate =
    | (acp.SessionMessage & { sessionUpdate: "session_message" })
    | (acp.SessionMessageChunk & { sessionUpdate: "session_message_chunk" });

/** Text from a session-directed message. Chunks append. A whole message replaces by sending its text once. */
function sessionMessageTexts(update: SessionMessageUpdate): string[] {
    if (update.sessionUpdate === "session_message_chunk") {
        const text = textFromContentBlock(update.content);
        return text !== undefined ? [text] : [];
    }
    if (update.content === undefined || update.content === null || update.content.length === 0) {
        return [];
    }
    return update.content
        .map((block) => textFromContentBlock(block))
        .filter((text): text is string => text !== undefined);
}

function sessionIdsInToolContent(content: unknown): string[] {
    if (!Array.isArray(content)) {
        return [];
    }
    const ids: string[] = [];
    for (const piece of content) {
        if (piece === null || typeof piece !== "object" || Array.isArray(piece)) {
            continue;
        }
        if (!("type" in piece) || piece.type !== "session" || !("sessionId" in piece)) {
            continue;
        }
        if (typeof piece.sessionId === "string" && piece.sessionId.length > 0) {
            ids.push(piece.sessionId);
        }
    }
    return ids;
}

/** Links a tool call to each `{ type: "session" }` content block without changing that child's status. */
function withSessionLinks(
    toolCallId: string,
    content: unknown,
    messages: ExtensionToWebviewMessage[],
): ExtensionToWebviewMessage[] {
    const links = sessionIdsInToolContent(content).map((sessionId): ExtensionToWebviewMessage => ({
        type: "subagentUpdate",
        sessionId,
        toolCallId,
    }));
    return links.length > 0 ? [...messages, ...links] : messages;
}

const subagentActivityTypes = new Set<SubagentActivityEvent["type"]>([
    "appendAgentText",
    "appendUserText",
    "appendUserImage",
    "appendAgentThought",
    "appendToolCall",
    "updateToolCall",
    "appendPlan",
]);

/** True when a parent transcript message can also land in a child subagent trace. */
export function isSubagentActivityMessage(
    message: ExtensionToWebviewMessage,
): message is SubagentActivityEvent {
    return subagentActivityTypes.has(message.type as SubagentActivityEvent["type"]);
}

function subagentWorkState(update: acp.SubagentUpdate): {
    state?: SubagentWorkState | null;
    stopReason?: string | null;
} {
    const snapshot = update.state;
    if (snapshot === undefined) {
        return {};
    }
    if (snapshot === null) {
        return { state: null, stopReason: null };
    }
    const name = snapshot.state;
    const state: SubagentWorkState =
        name === "running" || name === "idle" || name === "requires_action" || name === "unknown"
            ? name
            : "unknown";
    if (state !== "idle") {
        return { state, stopReason: null };
    }
    const stopReason =
        "stopReason" in snapshot && typeof snapshot.stopReason === "string"
            ? snapshot.stopReason
            : null;
    return { state, stopReason };
}

/** Maps an ACP `subagent_update` onto the parent chat. */
export function subagentUpdateMessage(update: acp.SubagentUpdate): ExtensionToWebviewMessage {
    return {
        type: "subagentUpdate",
        sessionId: update.sessionId,
        ...(update.title !== undefined ? { title: update.title } : {}),
        ...(update.description !== undefined ? { description: update.description } : {}),
        ...subagentWorkState(update),
    };
}

function cursorMetaToolCallId(update: object): string | undefined {
    const meta = "_meta" in update ? update._meta : undefined;
    if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
        return undefined;
    }
    const cursor = "cursor" in meta ? meta.cursor : undefined;
    if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) {
        return undefined;
    }
    const toolCallId = "toolCallId" in cursor ? cursor.toolCallId : undefined;
    return typeof toolCallId === "string" && toolCallId.length > 0 ? toolCallId : undefined;
}

/**
 * Cursor sends child sessions as `subagent_spawned` and `subagent_state_update`.
 * `disconnected` means the subagent is still running in the background.
 */
export function cursorSubagentUpdateMessage(
    update: acp.SessionUpdate,
): ExtensionToWebviewMessage | undefined {
    const raw = update as acp.SessionUpdate & {
        subagentSessionId?: unknown;
        name?: unknown;
        task?: unknown;
        state?: unknown;
    };
    const kind = String(raw.sessionUpdate);
    if (kind !== "subagent_spawned" && kind !== "subagent_state_update") {
        return undefined;
    }
    if (typeof raw.subagentSessionId !== "string" || raw.subagentSessionId.length === 0) {
        return undefined;
    }
    const toolCallId = cursorMetaToolCallId(raw);
    const link = toolCallId !== undefined ? { toolCallId } : {};
    if (kind === "subagent_spawned") {
        const name =
            typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name : "Subagent";
        return {
            type: "subagentUpdate",
            sessionId: raw.subagentSessionId,
            title: name,
            description: typeof raw.task === "string" ? raw.task : "",
            state: "running",
            stopReason: null,
            ...link,
        };
    }
    const stateName = typeof raw.state === "string" ? raw.state : "";
    if (stateName === "completed") {
        return {
            type: "subagentUpdate",
            sessionId: raw.subagentSessionId,
            state: "idle",
            stopReason: "end_turn",
            ...link,
        };
    }
    if (stateName === "failed" || stateName === "error") {
        return {
            type: "subagentUpdate",
            sessionId: raw.subagentSessionId,
            state: "idle",
            stopReason: "error",
            ...link,
        };
    }
    if (stateName === "cancelled") {
        return {
            type: "subagentUpdate",
            sessionId: raw.subagentSessionId,
            state: "idle",
            stopReason: "cancelled",
            ...link,
        };
    }
    if (stateName === "disconnected" || stateName === "running" || stateName === "background") {
        return {
            type: "subagentUpdate",
            sessionId: raw.subagentSessionId,
            state: "running",
            stopReason: null,
            ...link,
        };
    }
    return {
        type: "subagentUpdate",
        sessionId: raw.subagentSessionId,
        state: "unknown",
        ...link,
    };
}

/**
 * Routes a session notification to the parent transcript or a child subagent.
 * The outer `sessionId` is the parent for `subagent_update` and the child for later child events.
 */
function nestUnderOuterSession(
    message: ExtensionToWebviewMessage,
    outerSessionId: string,
    rootSessionId: string | null,
): ExtensionToWebviewMessage {
    if (message.type !== "subagentUpdate" || rootSessionId === null) {
        return message;
    }
    if (outerSessionId === rootSessionId || outerSessionId === message.sessionId) {
        return message;
    }
    return { ...message, parentSessionId: outerSessionId };
}

/**
 * A v2 child reports foreground work on its own `state_update`.
 * The open chat's `state_update` is not a subagent.
 */
function childStateUpdateMessage(
    update: acp.SessionUpdate,
    childSessionId: string,
): ExtensionToWebviewMessage | undefined {
    const raw = update as acp.SessionUpdate & { state?: unknown; stopReason?: unknown };
    if (String(raw.sessionUpdate) !== "state_update" || typeof raw.state !== "string") {
        return undefined;
    }
    const name = raw.state;
    const state: SubagentWorkState =
        name === "running" || name === "idle" || name === "requires_action" || name === "unknown"
            ? name
            : "unknown";
    const stopReason =
        state === "idle" && typeof raw.stopReason === "string" ? raw.stopReason : null;
    return {
        type: "subagentUpdate",
        sessionId: childSessionId,
        state,
        stopReason,
    };
}

export function messagesForSessionNotification(
    params: acp.SessionNotification,
    parentSessionId: string | null,
    tracking: ToolCallKindTracking,
): ExtensionToWebviewMessage[] {
    const cursorChild = cursorSubagentUpdateMessage(params.update);
    if (cursorChild !== undefined) {
        return [nestUnderOuterSession(cursorChild, params.sessionId, parentSessionId)];
    }
    if (params.update.sessionUpdate === "subagent_update") {
        return [
            nestUnderOuterSession(
                subagentUpdateMessage(params.update),
                params.sessionId,
                parentSessionId,
            ),
        ];
    }
    if (parentSessionId !== null && params.sessionId !== parentSessionId) {
        const childState = childStateUpdateMessage(params.update, params.sessionId);
        if (childState !== undefined) {
            return [childState];
        }
    }
    const messages = sessionUpdateToWebviewMessages(params.update, tracking);
    if (parentSessionId !== null && params.sessionId !== parentSessionId) {
        const childId = params.sessionId;
        return messages.flatMap((message) => {
            if (message.type === "subagentUpdate") {
                return [nestUnderOuterSession(message, childId, parentSessionId)];
            }
            return isSubagentActivityMessage(message)
                ? [{ type: "subagentActivity" as const, sessionId: childId, event: message }]
                : [];
        });
    }
    return messages;
}
