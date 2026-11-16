const SHELL_COMMAND_KEYS = [
    "command",
    "cmd",
    "CommandLine",
    "commandLine",
    "shellCommand",
    "shell_command",
    "bashCommand",
    "script",
    "line",
] as const;

function shellCommandFromRecord(record: Record<string, unknown>): string | undefined {
    for (const key of SHELL_COMMAND_KEYS) {
        const value = record[key];
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim();
        }
    }
    for (const [key, value] of Object.entries(record)) {
        if (typeof value !== "string" || value.trim().length === 0) {
            continue;
        }
        const lower = key.toLowerCase();
        if (lower === "commandline" || lower === "command" || lower === "cmd") {
            return value.trim();
        }
    }
    if (Array.isArray(record.argv) && record.argv.length > 0) {
        const parts = record.argv
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim());
        if (parts.length > 0) {
            return parts.join(" ");
        }
    }
    if (typeof record.program === "string" && record.program.trim().length > 0) {
        const program = record.program.trim();
        const args = Array.isArray(record.args)
            ? record.args.filter((entry): entry is string => typeof entry === "string")
            : [];
        return args.length > 0 ? `${program} ${args.join(" ")}` : program;
    }
    return undefined;
}

function shellCommandFromJsonString(text: string): string | undefined {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return undefined;
    }
    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            return shellCommandFromRecord(parsed as Record<string, unknown>);
        }
    } catch {
        return undefined;
    }
    return undefined;
}

/**
 * Pulls a one-line shell command from structured agent payloads (execute/terminal rawInput, rawOutput, or JSON strings).
 */
export function extractShellCommandLine(raw: unknown): string | undefined {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    if (typeof raw === "string") {
        const fromJson = shellCommandFromJsonString(raw);
        if (fromJson !== undefined) {
            return fromJson;
        }
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
        return undefined;
    }
    return shellCommandFromRecord(raw as Record<string, unknown>);
}
