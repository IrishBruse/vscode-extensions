import {
    env,
    Event,
    EventEmitter,
    ExtensionContext,
    ThemeIcon,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    Uri,
    window,
} from "vscode";
import { Commands, Views } from "../constants";
import { registerCommandIB } from "../lib/vscode/vscode";
import { formatListeningPort } from "./formatListeningPort";
import { killListeningProcess, listListeningPorts, type ListeningPort } from "./listListeningPorts";
import { listeningHttpUrl } from "./listeningHttpUrl";
import { annotateListeningPorts, type WebsiteHit } from "./websiteProbe";

const POLL_MS = 2000;

class PortTreeItem extends TreeItem {
    constructor(port: ListeningPort) {
        const text = formatListeningPort(port);
        super(text.label, TreeItemCollapsibleState.None);
        this.id = `port:${port.port}:${port.pid ?? "none"}`;
        this.description = text.description;
        this.tooltip = text.tooltip;
        this.contextValue = port.pid !== undefined ? "port" : "port-no-process";
        this.iconPath = new ThemeIcon(port.website ? "globe" : "plug");
        this.command = {
            title: "Open",
            command: Commands.OpenLocalPort,
            arguments: [port],
        };
        this.port = port;
    }

    readonly port: ListeningPort;
}

class MessageTreeItem extends TreeItem {
    constructor(label: string, icon?: string) {
        super(label, TreeItemCollapsibleState.None);
        this.contextValue = "info";
        if (icon) {
            this.iconPath = new ThemeIcon(icon);
        }
    }
}

export class LocalPortsViewProvider implements TreeDataProvider<TreeItem> {
    private changeEvent = new EventEmitter<TreeItem | undefined | null>();
    private timer: ReturnType<typeof setInterval> | undefined;
    private generation = 0;
    private ports: ListeningPort[] = [];
    private loadError: string | undefined;
    private signature = "";
    private websiteCache = new Map<string, WebsiteHit>();

    get onDidChangeTreeData(): Event<TreeItem | undefined | null> {
        return this.changeEvent.event;
    }

    static activate(context: ExtensionContext): void {
        const provider = new LocalPortsViewProvider();
        const treeView = window.createTreeView(Views.LocalPorts, {
            treeDataProvider: provider,
        });
        context.subscriptions.push(treeView);
        context.subscriptions.push(
            treeView.onDidChangeVisibility((event) => {
                if (event.visible) {
                    provider.startPolling();
                } else {
                    provider.stopPolling();
                }
            }),
        );
        if (treeView.visible) {
            provider.startPolling();
        }

        registerCommandIB(Commands.RefreshLocalPorts, () => provider.refresh(), context);
        registerCommandIB(
            Commands.OpenLocalPort,
            (port?: ListeningPort) => provider.open(port),
            context,
        );
        registerCommandIB(
            Commands.KillLocalPort,
            (item?: PortTreeItem) => provider.kill(item),
            context,
        );
        context.subscriptions.push({ dispose: () => provider.stopPolling() });
    }

    getTreeItem(element: TreeItem): TreeItem {
        return element;
    }

    getChildren(): TreeItem[] {
        if (this.loadError) {
            return [new MessageTreeItem(this.loadError, "error")];
        }
        if (this.ports.length === 0) {
            return [new MessageTreeItem("No listening ports")];
        }
        return this.ports.map((port) => new PortTreeItem(port));
    }

    startPolling(): void {
        void this.refresh();
        if (this.timer) {
            return;
        }
        this.timer = setInterval(() => {
            void this.refresh();
        }, POLL_MS);
    }

    stopPolling(): void {
        if (!this.timer) {
            return;
        }
        clearInterval(this.timer);
        this.timer = undefined;
    }

    async refresh(): Promise<void> {
        const generation = ++this.generation;
        try {
            const ports = await listListeningPorts();
            const annotated = await annotateListeningPorts(ports, this.websiteCache);
            if (generation !== this.generation) {
                return;
            }
            this.ports = annotated;
            this.loadError = undefined;
        } catch (error) {
            if (generation !== this.generation) {
                return;
            }
            this.loadError = error instanceof Error ? error.message : String(error);
        }
        this.publish();
    }

    private async open(port?: ListeningPort): Promise<void> {
        if (!port) {
            return;
        }
        const url = listeningHttpUrl(port.address, port.port);
        await env.openExternal(Uri.parse(url));
    }

    private async kill(item?: PortTreeItem): Promise<void> {
        const pid = item?.port.pid;
        if (!item || pid === undefined) {
            return;
        }

        const name = item.port.label || `port ${item.port.port}`;
        try {
            killListeningProcess(pid);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            void window.showErrorMessage(`Could not stop ${name}: ${message}`);
        }
        await this.refresh();
    }

    private publish(): void {
        const signature = this.loadError
            ? `error:${this.loadError}`
            : this.ports
                  .map(
                      (port) =>
                          `${port.pid}:${port.port}:${port.label}:${port.title ?? ""}:${port.processName ?? ""}:${port.address}:${port.website ? 1 : 0}`,
                  )
                  .join("|");
        if (signature === this.signature) {
            return;
        }
        this.signature = signature;
        this.changeEvent.fire(undefined);
    }
}
