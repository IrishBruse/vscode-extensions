import type * as acp from "@agentclientprotocol/sdk";
import type { AcpUiMcpServerRow } from "../../protocol/extensionHostMessages";

export type McpExpandContext = {
    workspaceFolder?: string;
    userHome?: string;
    env: Readonly<Record<string, string | undefined>>;
};

export type McpConfigDocument = {
    source: string;
    /** File text. Omit when the file is missing. */
    text?: string;
    /** Already parsed settings object. */
    value?: unknown;
};

export type McpForwardReport = {
    forwarded: acp.McpServer[];
    servers: AcpUiMcpServerRow[];
    note?: string;
};

type Transport = AcpUiMcpServerRow["transport"];

type ConfiguredServer = {
    name: string;
    source: string;
    transport: Transport;
    detail: string;
    disabled: boolean;
    problem?: string;
    server?: acp.McpServer;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function expandText(value: string, context: McpExpandContext): string {
    const workspace = context.workspaceFolder ?? "";
    const home = context.userHome ?? "";
    return value
        .replaceAll("${workspaceFolder}", workspace)
        .replaceAll("${userHome}", home)
        .replace(/\$\{env:([^}]+)\}/g, (_match, name: string) => context.env[name] ?? "");
}

function stringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item): item is string => typeof item === "string");
}

function namedPairs(
    value: unknown,
    context: McpExpandContext,
): Array<{ name: string; value: string }> {
    if (isRecord(value)) {
        const pairs: Array<{ name: string; value: string }> = [];
        for (const [name, raw] of Object.entries(value)) {
            if (typeof raw === "string" && name.length > 0) {
                pairs.push({ name, value: expandText(raw, context) });
            }
        }
        return pairs;
    }
    if (!Array.isArray(value)) {
        return [];
    }
    const pairs: Array<{ name: string; value: string }> = [];
    for (const item of value) {
        if (!isRecord(item) || typeof item.name !== "string" || typeof item.value !== "string") {
            continue;
        }
        if (item.name.length === 0) {
            continue;
        }
        pairs.push({ name: item.name, value: expandText(item.value, context) });
    }
    return pairs;
}

function serverMap(root: unknown): Record<string, unknown> | undefined {
    if (!isRecord(root)) {
        return undefined;
    }
    if (isRecord(root.mcpServers)) {
        return root.mcpServers;
    }
    if (isRecord(root.servers)) {
        return root.servers;
    }
    return root;
}

function transportFor(entry: Record<string, unknown>, url: string): Transport | undefined {
    const type = typeof entry.type === "string" ? entry.type.trim().toLowerCase() : "";
    if (url.length > 0) {
        return type === "sse" ? "sse" : "http";
    }
    if (typeof entry.command === "string" && entry.command.trim().length > 0) {
        return "stdio";
    }
    return undefined;
}

function configuredServer(
    name: string,
    entry: unknown,
    source: string,
    context: McpExpandContext,
): ConfiguredServer {
    if (!isRecord(entry)) {
        return {
            name,
            source,
            transport: "stdio",
            detail: "",
            disabled: false,
            problem: "Missing command or URL",
        };
    }
    const disabled = entry.disabled === true;
    const rawUrl = typeof entry.url === "string" ? entry.url.trim() : "";
    const rawCommand = typeof entry.command === "string" ? entry.command.trim() : "";
    const rawArgs = stringList(entry.args);
    const transport = transportFor(entry, rawUrl);
    if (transport === undefined) {
        return {
            name,
            source,
            transport: "stdio",
            detail: "",
            disabled,
            problem: "Missing command or URL",
        };
    }
    const detail = transport === "stdio" ? [rawCommand, ...rawArgs].join(" ") : rawUrl;
    if (disabled) {
        return { name, source, transport, detail, disabled: true };
    }
    if (transport === "stdio") {
        const server: acp.McpServerStdio = {
            name,
            command: expandText(rawCommand, context),
            args: rawArgs.map((arg) => expandText(arg, context)),
            env: namedPairs(entry.env, context),
        };
        return { name, source, transport, detail, disabled: false, server };
    }
    const remote = {
        name,
        url: expandText(rawUrl, context),
        headers: namedPairs(entry.headers, context),
    };
    const server: acp.McpServer =
        transport === "sse" ? { ...remote, type: "sse" } : { ...remote, type: "http" };
    return { name, source, transport, detail, disabled: false, server };
}

function serversFromValue(
    value: unknown,
    source: string,
    context: McpExpandContext,
): { servers: ConfiguredServer[]; error?: string } {
    const map = serverMap(value);
    if (map === undefined) {
        return { servers: [], error: "MCP config must be a JSON object" };
    }
    const servers: ConfiguredServer[] = [];
    for (const [name, entry] of Object.entries(map)) {
        if (name === "mcpServers" || name === "servers" || name === "inputs") {
            continue;
        }
        if (!isRecord(entry)) {
            continue;
        }
        servers.push(configuredServer(name, entry, source, context));
    }
    return { servers };
}

function documentServers(
    document: McpConfigDocument,
    context: McpExpandContext,
): { servers: ConfiguredServer[]; error?: string } {
    if (document.text === undefined && document.value === undefined) {
        return { servers: [] };
    }
    if (document.text !== undefined) {
        if (document.text.trim().length === 0) {
            return { servers: [] };
        }
        let value: unknown;
        try {
            value = JSON.parse(document.text);
        } catch {
            return { servers: [], error: `Could not read ${document.source}` };
        }
        const parsed = serversFromValue(value, document.source, context);
        if (parsed.error !== undefined) {
            return { servers: [], error: `Could not read ${document.source}` };
        }
        return parsed;
    }
    return serversFromValue(document.value, document.source, context);
}

function mergeServers(
    documents: readonly McpConfigDocument[],
    context: McpExpandContext,
): {
    servers: ConfiguredServer[];
    notes: string[];
} {
    const byName = new Map<string, ConfiguredServer>();
    const notes: string[] = [];
    for (const document of documents) {
        const parsed = documentServers(document, context);
        if (parsed.error !== undefined) {
            notes.push(parsed.error);
        }
        for (const server of parsed.servers) {
            byName.set(server.name, server);
        }
    }
    return { servers: [...byName.values()], notes };
}

function skipReason(
    server: ConfiguredServer,
    capabilities: acp.McpCapabilities | undefined,
): string | undefined {
    if (server.problem !== undefined) {
        return server.problem;
    }
    if (server.disabled) {
        return "Disabled";
    }
    if (server.transport === "http" && capabilities?.http !== true) {
        return "This agent does not accept HTTP MCP servers";
    }
    if (server.transport === "sse" && capabilities?.sse !== true) {
        return "This agent does not accept SSE MCP servers";
    }
    if (server.server === undefined) {
        return "Missing command or URL";
    }
    return undefined;
}

/** Merges Cursor and VS Code MCP documents and keeps the servers this agent can accept. */
export function mcpReportFromDocuments(
    documents: readonly McpConfigDocument[],
    context: McpExpandContext,
    capabilities: acp.McpCapabilities | undefined,
): McpForwardReport {
    const merged = mergeServers(documents, context);
    const forwarded: acp.McpServer[] = [];
    const servers: AcpUiMcpServerRow[] = [];
    for (const server of merged.servers) {
        const reason = skipReason(server, capabilities);
        if (reason === undefined && server.server !== undefined) {
            forwarded.push(server.server);
        }
        servers.push({
            name: server.name,
            transport: server.transport,
            detail: server.detail,
            source: server.source,
            forwarded: reason === undefined,
            ...(reason !== undefined ? { skipReason: reason } : {}),
        });
    }
    const note = merged.notes.length > 0 ? merged.notes.join("\n") : undefined;
    return {
        forwarded,
        servers,
        ...(note !== undefined ? { note } : {}),
    };
}
