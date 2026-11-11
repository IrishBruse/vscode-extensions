import type { AcpAgentSpawnConfig } from "../acp/domain/agentSpawnConfig";
import type { AcpUiSessionConnectionStatus } from "./acpUiSessionConnection";

export const cmdAddAcpClient = "ib-acp-ui.addAcpClient";
export const cmdSelectActiveAgent = "ib-acp-ui.selectActiveAgent";

/** One ACP client shown in the setup sidebar. */
export type AcpUiSetupClient = {
    name: string;
    command: string;
    args: string[];
    source: "settings" | "registry";
    registryId?: string;
    active: boolean;
};

/** Review facts for the chat open in the active editor. */
export type AcpUiSetupOpenChat = {
    title: string;
    agentName?: string;
    localSessionId: string;
    runtimeSessionId?: string;
    filePath: string;
    connection?: AcpUiSessionConnectionStatus;
    connectionError?: string;
};

export type AcpUiSetupModel = {
    clients: AcpUiSetupClient[];
    activeClientName?: string;
    workspacePath?: string;
    openChat?: AcpUiSetupOpenChat;
};

export type AcpUiSetupContextValue =
    | "section"
    | "clientSettings"
    | "clientRegistry"
    | "action"
    | "fact";

export type AcpUiSetupNode = {
    id: string;
    label: string;
    description?: string;
    tooltip: string;
    collapsible: boolean;
    contextValue: AcpUiSetupContextValue;
    commandId?: string;
    commandArgs?: string[];
    clientName?: string;
    registryId?: string;
    children: AcpUiSetupNode[];
};

function clientCommandLine(client: AcpUiSetupClient): string {
    return [client.command, ...client.args].join(" ").trim();
}

function fact(id: string, label: string, description: string, tooltip: string): AcpUiSetupNode {
    return {
        id,
        label,
        ...(description.length > 0 ? { description } : {}),
        tooltip,
        collapsible: false,
        contextValue: "fact",
        children: [],
    };
}

function section(id: string, label: string, tooltip: string): AcpUiSetupNode {
    return {
        id,
        label,
        tooltip,
        collapsible: false,
        contextValue: "section",
        children: [],
    };
}

/** Labels merged clients as settings or registry entries and marks the active one. */
export function setupClientsFromConfigs(
    manual: AcpAgentSpawnConfig[],
    merged: AcpAgentSpawnConfig[],
    activeName: string | undefined,
): AcpUiSetupClient[] {
    const manualNames = new Set(manual.map((entry) => entry.name));
    return merged.map((entry) => ({
        name: entry.name,
        command: entry.command,
        args: entry.args,
        source: manualNames.has(entry.name) ? "settings" : "registry",
        ...(entry.registryId !== undefined ? { registryId: entry.registryId } : {}),
        active: entry.name === activeName,
    }));
}

/** Splits an arguments input box into spawn args. */
export function parseClientArgsInput(value: string): string[] {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return [];
    }
    return trimmed.split(/\s+/);
}

/** Inserts or replaces a manual client by display name. */
export function manualClientsAfterAdd(
    current: AcpAgentSpawnConfig[],
    next: AcpAgentSpawnConfig,
): AcpAgentSpawnConfig[] {
    return [...current.filter((entry) => entry.name !== next.name), next];
}

/** Updates the command and args of one manual client and keeps its other fields. */
export function manualClientsAfterEdit(
    current: AcpAgentSpawnConfig[],
    name: string,
    patch: { command: string; args: string[] },
): AcpAgentSpawnConfig[] {
    return current.map((entry) =>
        entry.name === name ? { ...entry, command: patch.command, args: patch.args } : entry,
    );
}

/** Drops a manual client by display name. */
export function manualClientsAfterRemove(
    current: AcpAgentSpawnConfig[],
    name: string,
): AcpAgentSpawnConfig[] {
    return current.filter((entry) => entry.name !== name);
}

function clientNode(client: AcpUiSetupClient): AcpUiSetupNode {
    const commandLine = clientCommandLine(client);
    const sourceLabel = client.source === "registry" ? "registry" : "settings";
    return {
        id: `client:${client.name}`,
        label: client.name,
        description: client.active ? `active · ${commandLine}` : commandLine,
        tooltip: `${client.name}\n${commandLine}\n${sourceLabel}${client.active ? "\nActive for new chats" : ""}`,
        collapsible: false,
        contextValue: client.source === "registry" ? "clientRegistry" : "clientSettings",
        commandId: cmdSelectActiveAgent,
        commandArgs: [client.name],
        clientName: client.name,
        ...(client.registryId !== undefined ? { registryId: client.registryId } : {}),
        children: [],
    };
}

function connectionStatusLabel(status: AcpUiSessionConnectionStatus | undefined): string {
    if (status === "connected") {
        return "Connected";
    }
    if (status === "connecting") {
        return "Connecting…";
    }
    if (status === "disconnected") {
        return "Disconnected";
    }
    return "Unknown";
}

function openChatNodes(openChat: AcpUiSetupOpenChat | undefined): AcpUiSetupNode[] {
    if (openChat === undefined) {
        return [
            fact("chat:empty", "No chat open", "", "Open a chat in the editor to review it here"),
        ];
    }
    return [
        fact("chat:title", "Title", openChat.title, "Title of the chat in the active editor"),
        fact(
            "chat:client",
            "Client",
            openChat.agentName ?? "Unknown",
            "ACP client this chat was opened with",
        ),
        fact("chat:file", "File", openChat.filePath, "Session file for this chat"),
        fact("chat:local", "Local id", openChat.localSessionId, "Local session id"),
        fact(
            "chat:runtime",
            "Runtime session",
            openChat.runtimeSessionId ?? "Not connected",
            "Agent runtime session id",
        ),
        fact(
            "chat:connection",
            "ACP connection",
            connectionStatusLabel(openChat.connection),
            "Whether the ACP agent process for this chat is running",
        ),
        ...(openChat.connection === "disconnected" &&
        openChat.connectionError !== undefined &&
        openChat.connectionError.length > 0
            ? [
                  fact(
                      "chat:connection-error",
                      "Error",
                      openChat.connectionError,
                      openChat.connectionError,
                  ),
              ]
            : []),
    ];
}

/** Builds the setup sidebar: clients, runtime choices, and the open chat. */
export function buildAcpUiSetupTree(model: AcpUiSetupModel): AcpUiSetupNode[] {
    const clientChildren: AcpUiSetupNode[] =
        model.clients.length === 0
            ? [fact("clients:empty", "No clients yet", "", "Add a manual client")]
            : model.clients.map(clientNode);
    clientChildren.push({
        id: "action:add-client",
        label: "Add client…",
        tooltip: "Add a manual ACP client to settings",
        collapsible: false,
        contextValue: "action",
        commandId: cmdAddAcpClient,
        children: [],
    });

    const runtimeChildren: AcpUiSetupNode[] = [
        {
            id: "runtime:active-client",
            label: "New chats use",
            description: model.activeClientName ?? "None",
            tooltip: "Active client for new chats. Stored in extension state, not settings.json.",
            collapsible: false,
            contextValue: "fact",
            commandId: cmdSelectActiveAgent,
            children: [],
        },
        fact(
            "runtime:workspace",
            "Workspace",
            model.workspacePath ?? "No folder open",
            "Folder used as the agent working directory",
        ),
    ];

    return [
        section("section:clients", "Clients", "ACP clients used to start chats"),
        ...clientChildren,
        section("section:runtime", "Runtime", "Choices stored outside VS Code settings"),
        ...runtimeChildren,
        section("section:open-chat", "Open chat", "Review the chat in the active editor"),
        ...openChatNodes(model.openChat),
    ];
}
