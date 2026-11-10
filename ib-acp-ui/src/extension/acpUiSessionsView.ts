import {
    ConfigurationTarget,
    commands,
    type Event,
    EventEmitter,
    type ExtensionContext,
    RelativePattern,
    ThemeIcon,
    type TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    window,
    workspace,
} from "vscode";
import type { AcpAgentSpawnConfig } from "../acp/domain/agentSpawnConfig";
import { getAcpAgentConfigsMerged } from "../acp/config/mergedAgents";
import { getAcpAgentConfigsFromSettings } from "../acp/config/vscodeSettingsAgents";
import { registerCommandIB } from "../utils/vscode";
import { removeInstalledAgent } from "./acpUiInstalledAgents";
import { agentPickLabel } from "./acpUiAgentPicker";
import { promptNoAcpAgentsConfigured } from "./acpUiNoAgentsPrompt";
import {
    getActiveAgentConfig,
    initializeAcpUiActiveAgent,
    setActiveAgentName,
} from "./acpUiActiveAgent";
import { getActiveAcpSessionUri } from "./acpUiPanel";
import { resolveSessionsDirectoryUri } from "./acpUiSessionJsonl";
import { listAcpUiSessions, refreshAcpUiSessionsFromDisk } from "./acpUiSessionsStore";
import { getAcpUiSessionConnection } from "./acpUiSessionConnection";
import {
    type AcpUiSetupNode,
    type AcpUiSetupOpenChat,
    buildAcpUiSetupTree,
    cmdAddAcpClient,
    manualClientsAfterAdd,
    manualClientsAfterEdit,
    manualClientsAfterRemove,
    parseClientArgsInput,
    setupClientsFromConfigs,
} from "./acpUiSetupTree";

const viewIdAcpUiSessions = "acpUiSessionsView";
const agentsSettingKey = "ib-acp-ui.agents";

const cmdFocusAcpUiSessions = "ib-acp-ui.focusAcpUiSessions";
const cmdRefreshAcpUiSessions = "ib-acp-ui.refreshAcpUiSessions";
const cmdSelectActiveAgent = "ib-acp-ui.selectActiveAgent";
const cmdEditAcpClient = "ib-acp-ui.editAcpClient";
const cmdRemoveAcpClient = "ib-acp-ui.removeAcpClient";
const cmdUninstallSetupClient = "ib-acp-ui.uninstallSetupClient";

let refreshSetupView: (() => void) | undefined;

/** Rebuilds the setup sidebar after a registry install or uninstall. */
export function refreshAcpUiSetupView(): void {
    refreshSetupView?.();
}

class SetupTreeItem extends TreeItem {
    constructor(public readonly node: AcpUiSetupNode) {
        super(
            node.label,
            node.collapsible ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None,
        );
        this.id = node.id;
        this.description = node.description;
        this.tooltip = node.tooltip;
        this.contextValue = node.contextValue;
        if (node.contextValue === "clientSettings" || node.contextValue === "clientRegistry") {
            this.iconPath = new ThemeIcon("server");
        } else if (node.id === "action:add-client") {
            this.iconPath = new ThemeIcon("add");
        } else if (node.id === "action:browse-registry") {
            this.iconPath = new ThemeIcon("cloud-download");
        }
        if (node.commandId !== undefined) {
            this.command = {
                title: node.label,
                command: node.commandId,
                arguments: node.commandArgs,
            };
        }
    }
}

function setupNodeFromArg(arg: unknown): AcpUiSetupNode | undefined {
    return arg instanceof SetupTreeItem ? arg.node : undefined;
}

function toSettingsEntry(entry: AcpAgentSpawnConfig): Record<string, unknown> {
    return {
        name: entry.name,
        command: entry.command,
        ...(entry.args.length > 0 ? { args: entry.args } : {}),
        ...(entry.env !== undefined ? { env: entry.env } : {}),
        ...(entry.authMethodId !== undefined ? { authMethodId: entry.authMethodId } : {}),
    };
}

async function writeManualClients(next: AcpAgentSpawnConfig[]): Promise<void> {
    const config = workspace.getConfiguration();
    const inspected = config.inspect<unknown[]>(agentsSettingKey);
    const hasWorkspace =
        inspected?.workspaceValue !== undefined && (workspace.workspaceFolders?.length ?? 0) > 0;
    await config.update(
        agentsSettingKey,
        next.map(toSettingsEntry),
        hasWorkspace ? ConfigurationTarget.Workspace : ConfigurationTarget.Global,
    );
}

async function promptRequired(
    title: string,
    prompt: string,
    value?: string,
): Promise<string | undefined> {
    return window.showInputBox({
        title,
        prompt,
        ...(value !== undefined ? { value } : {}),
        validateInput: (input) => (input.trim().length === 0 ? "Cannot be empty" : undefined),
    });
}

export class AcpUiSessionsViewProvider implements TreeDataProvider<SetupTreeItem> {
    private changeEvent = new EventEmitter<SetupTreeItem | undefined>();
    private roots: AcpUiSetupNode[] = [];

    public get onDidChangeTreeData(): Event<SetupTreeItem | undefined> {
        return this.changeEvent.event;
    }

    /**
     * Registers the setup sidebar. Returns a function that refreshes it.
     */
    static activate(context: ExtensionContext): () => void {
        initializeAcpUiActiveAgent(context);
        const provider = new AcpUiSessionsViewProvider();
        const refresh = (): void => provider.refresh();
        refreshSetupView = refresh;
        refresh();
        const treeView = window.createTreeView(viewIdAcpUiSessions, {
            treeDataProvider: provider,
        });
        context.subscriptions.push(treeView);

        const sessionsDir = resolveSessionsDirectoryUri(context);
        const watcher = workspace.createFileSystemWatcher(
            new RelativePattern(sessionsDir, "**/*.acp"),
        );
        const onDiskChange = (): void => {
            void refreshAcpUiSessionsFromDisk().then(() => provider.refresh());
        };
        watcher.onDidCreate(onDiskChange);
        watcher.onDidDelete(onDiskChange);
        watcher.onDidChange(onDiskChange);
        context.subscriptions.push(watcher);
        context.subscriptions.push(
            workspace.onDidChangeConfiguration((event) => {
                if (event.affectsConfiguration(agentsSettingKey)) {
                    provider.refresh();
                }
            }),
        );
        context.subscriptions.push(window.onDidChangeActiveTextEditor(() => provider.refresh()));
        context.subscriptions.push(window.tabGroups.onDidChangeTabs(() => provider.refresh()));

        registerCommandIB(cmdRefreshAcpUiSessions, () => provider.refresh(), context);
        registerCommandIB(
            cmdSelectActiveAgent,
            (...args: unknown[]) => {
                const name = args[0];
                if (typeof name === "string" && name.length > 0) {
                    return provider.selectClientByName(name);
                }
                return provider.selectActiveAgent();
            },
            context,
        );
        registerCommandIB(cmdAddAcpClient, () => provider.addClient(), context);
        registerCommandIB(cmdEditAcpClient, (item: unknown) => provider.editClient(item), context);
        registerCommandIB(
            cmdRemoveAcpClient,
            (item: unknown) => provider.removeClient(item),
            context,
        );
        registerCommandIB(
            cmdUninstallSetupClient,
            (item: unknown) => provider.uninstallClient(item),
            context,
        );
        registerCommandIB(
            cmdFocusAcpUiSessions,
            () => commands.executeCommand(`${viewIdAcpUiSessions}.focus`),
            context,
        );

        return refresh;
    }

    refresh(): void {
        const active = getActiveAgentConfig();
        this.roots = buildAcpUiSetupTree({
            clients: setupClientsFromConfigs(
                getAcpAgentConfigsFromSettings(),
                getAcpAgentConfigsMerged(),
                active?.name,
            ),
            ...(active !== undefined ? { activeClientName: active.name } : {}),
            workspacePath: workspace.workspaceFolders?.[0]?.uri.fsPath,
            ...this.openChatModel(),
        });
        this.changeEvent.fire(undefined);
    }

    getTreeItem(element: SetupTreeItem): TreeItem {
        return element;
    }

    async getChildren(element?: SetupTreeItem): Promise<SetupTreeItem[]> {
        const nodes = element === undefined ? this.roots : element.node.children;
        return nodes.map((node) => new SetupTreeItem(node));
    }

    getParent(): undefined {
        return undefined;
    }

    private openChatModel(): { openChat?: AcpUiSetupOpenChat } {
        const uri = getActiveAcpSessionUri();
        if (uri === undefined) {
            return {};
        }
        const record = listAcpUiSessions().find((row) => row.uri.toString() === uri.toString());
        if (record === undefined) {
            return {};
        }
        const connection = getAcpUiSessionConnection(record.id);
        return {
            openChat: {
                title: record.title,
                ...(record.agentName !== undefined ? { agentName: record.agentName } : {}),
                localSessionId: record.id,
                ...(record.sessionId !== undefined && record.sessionId.length > 0
                    ? { runtimeSessionId: record.sessionId }
                    : {}),
                filePath: record.uri.fsPath,
                ...(connection !== undefined
                    ? {
                          connection: connection.status,
                          ...(connection.message !== undefined
                              ? { connectionError: connection.message }
                              : {}),
                      }
                    : {}),
            },
        };
    }

    private async selectClientByName(name: string): Promise<void> {
        const match = getAcpAgentConfigsMerged().find((entry) => entry.name === name);
        if (match === undefined) {
            window.showErrorMessage(`No ACP client named "${name}".`);
            return;
        }
        await setActiveAgentName(match.name);
        this.refresh();
    }

    private async selectActiveAgent(): Promise<void> {
        const configs = getAcpAgentConfigsMerged();
        if (configs.length === 0) {
            await promptNoAcpAgentsConfigured();
            return;
        }
        const manualNames = new Set(getAcpAgentConfigsFromSettings().map((config) => config.name));
        const current = getActiveAgentConfig();
        const picked = await window.showQuickPick(
            configs.map((config) => ({
                label: agentPickLabel(config, manualNames),
                config,
                picked: config.name === current?.name,
            })),
            {
                placeHolder: "Select the client new chats use",
            },
        );
        if (picked === undefined) {
            return;
        }
        await setActiveAgentName(picked.config.name);
        this.refresh();
    }

    private async addClient(): Promise<void> {
        const name = await promptRequired("Add ACP client", "Display name");
        if (name === undefined) {
            return;
        }
        const command = await promptRequired("Add ACP client", "Executable to spawn");
        if (command === undefined) {
            return;
        }
        const argsInput = await window.showInputBox({
            title: "Add ACP client",
            prompt: "Arguments (optional)",
            placeHolder: "acp",
        });
        if (argsInput === undefined) {
            return;
        }
        const trimmedName = name.trim();
        await writeManualClients(
            manualClientsAfterAdd(getAcpAgentConfigsFromSettings(), {
                name: trimmedName,
                command: command.trim(),
                args: parseClientArgsInput(argsInput),
            }),
        );
        await setActiveAgentName(trimmedName);
        this.refresh();
    }

    private async editClient(item: unknown): Promise<void> {
        const node = setupNodeFromArg(item);
        const name = node?.clientName;
        if (name === undefined) {
            window.showErrorMessage("Select a settings client to edit.");
            return;
        }
        const current = getAcpAgentConfigsFromSettings().find((entry) => entry.name === name);
        if (current === undefined) {
            window.showErrorMessage("That client is stored by the registry, not in settings.");
            return;
        }
        const command = await promptRequired(
            `Edit ${current.name}`,
            "Executable to spawn",
            current.command,
        );
        if (command === undefined) {
            return;
        }
        const argsInput = await window.showInputBox({
            title: `Edit ${current.name}`,
            prompt: "Arguments",
            value: current.args.join(" "),
        });
        if (argsInput === undefined) {
            return;
        }
        await writeManualClients(
            manualClientsAfterEdit(getAcpAgentConfigsFromSettings(), current.name, {
                command: command.trim(),
                args: parseClientArgsInput(argsInput),
            }),
        );
        this.refresh();
    }

    private async removeClient(item: unknown): Promise<void> {
        const name = setupNodeFromArg(item)?.clientName;
        if (name === undefined) {
            window.showErrorMessage("Select a settings client to remove.");
            return;
        }
        const answer = await window.showWarningMessage(
            `Remove client "${name}" from settings?`,
            { modal: true },
            "Remove",
        );
        if (answer !== "Remove") {
            return;
        }
        await writeManualClients(manualClientsAfterRemove(getAcpAgentConfigsFromSettings(), name));
        this.refresh();
    }

    private async uninstallClient(item: unknown): Promise<void> {
        const node = setupNodeFromArg(item);
        const registryId = node?.registryId;
        if (registryId === undefined || node?.clientName === undefined) {
            window.showErrorMessage("Select a registry client to uninstall.");
            return;
        }
        const answer = await window.showWarningMessage(
            `Uninstall registry client "${node.clientName}"?`,
            { modal: true },
            "Uninstall",
        );
        if (answer !== "Uninstall") {
            return;
        }
        await removeInstalledAgent(registryId);
        this.refresh();
    }
}
