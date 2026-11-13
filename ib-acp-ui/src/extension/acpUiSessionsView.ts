import {
    ConfigurationTarget,
    type ExtensionContext,
    RelativePattern,
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
import { resolveSessionsDirectoryUri } from "./acpUiSessionJsonl";
import { refreshAcpUiSessionsFromDisk } from "./acpUiSessionsStore";
import {
    cmdAddAcpClient,
    manualClientsAfterAdd,
    manualClientsAfterEdit,
    manualClientsAfterRemove,
    parseClientArgsInput,
} from "./acpUiSetupTree";

const agentsSettingKey = "ib-acp-ui.agents";

const cmdRefreshAcpUiSessions = "ib-acp-ui.refreshAcpUiSessions";
const cmdSelectActiveAgent = "ib-acp-ui.selectActiveAgent";
const cmdEditAcpClient = "ib-acp-ui.editAcpClient";
const cmdRemoveAcpClient = "ib-acp-ui.removeAcpClient";
const cmdUninstallSetupClient = "ib-acp-ui.uninstallSetupClient";

let refreshSetupView: (() => void) | undefined;

/** Reloads the session index after a registry install or uninstall. */
export function refreshAcpUiSetupView(): void {
    refreshSetupView?.();
}

function clientRefFromArg(arg: unknown): { clientName?: string; registryId?: string } | undefined {
    if (arg === null || typeof arg !== "object") {
        return undefined;
    }
    const row = arg as Record<string, unknown>;
    const clientName = typeof row.clientName === "string" ? row.clientName : undefined;
    const registryId = typeof row.registryId === "string" ? row.registryId : undefined;
    if (clientName === undefined && registryId === undefined) {
        return undefined;
    }
    return {
        ...(clientName !== undefined ? { clientName } : {}),
        ...(registryId !== undefined ? { registryId } : {}),
    };
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

export class AcpUiSessionsViewProvider {
    /**
     * Registers chat commands and the session-file watcher.
     * Returns a function other features can call after a chat change.
     */
    static activate(context: ExtensionContext): () => void {
        initializeAcpUiActiveAgent(context);
        const provider = new AcpUiSessionsViewProvider();
        const refresh = (): void => provider.refresh();
        refreshSetupView = refresh;

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

        registerCommandIB(
            cmdRefreshAcpUiSessions,
            () => {
                void refreshAcpUiSessionsFromDisk();
            },
            context,
        );
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
        return refresh;
    }

    refresh(): void {
        void refreshAcpUiSessionsFromDisk();
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
        const name = clientRefFromArg(item)?.clientName;
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
        const name = clientRefFromArg(item)?.clientName;
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
        const node = clientRefFromArg(item);
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
