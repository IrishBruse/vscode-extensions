import {
    type CancellationToken,
    type CustomTextEditorProvider,
    type ExtensionContext,
    type TextDocument,
    ThemeIcon,
    type Uri,
    type WebviewPanel,
    window,
    workspace,
} from "vscode";
import {
    type AgentTabIndicator,
    agentTabGeneratingFrames,
    agentTabTitleFrameMs,
    formatAgentTabTitle,
} from "../protocol/agentTabTitle";
import { AcpUiSessionController } from "./acpUiSessionController";
import { ensureSessionFileNamedById, parseSessionFile } from "./acpUiSessionJsonl";
import { updateAcpUiSessionFileUri } from "./acpUiSessionsStore";
import { getAcpUiWebviewHtml } from "./acpUiWebviewShell";

export const acpUiCustomEditorViewType = "ibAcpUi.session";

const acpUiPanelTabIcon = new ThemeIcon("comment-discussion");

const controllersByDocumentUri = new Map<string, AcpUiSessionController>();
const panelsByDocumentUri = new Map<string, WebviewPanel>();

type AgentTabTitleRuntime = {
    baseTitle: string;
    indicator: AgentTabIndicator | null;
    animate: boolean;
    frame: number;
    timer: ReturnType<typeof setInterval> | undefined;
};

const agentTabTitles = new Map<string, AgentTabTitleRuntime>();

let refreshChatsListHandler: (() => void) | undefined;

function clearAgentTabTimer(state: AgentTabTitleRuntime): void {
    if (state.timer !== undefined) {
        clearInterval(state.timer);
        state.timer = undefined;
    }
}

function paintAgentTabTitle(uriKey: string): void {
    const panel = panelsByDocumentUri.get(uriKey);
    const state = agentTabTitles.get(uriKey);
    if (panel === undefined || state === undefined) {
        return;
    }
    panel.title = formatAgentTabTitle(state.baseTitle, state.indicator, state.frame);
}

function syncAgentTabTimer(uriKey: string, state: AgentTabTitleRuntime): void {
    const shouldAnimate = state.indicator === "generating" && state.animate;
    if (!shouldAnimate) {
        clearAgentTabTimer(state);
        return;
    }
    if (state.timer !== undefined) {
        return;
    }
    state.timer = setInterval(() => {
        state.frame = (state.frame + 1) % agentTabGeneratingFrames.length;
        paintAgentTabTitle(uriKey);
    }, agentTabTitleFrameMs);
}

function disposeAgentTabTitle(uriKey: string): void {
    const state = agentTabTitles.get(uriKey);
    if (state === undefined) {
        return;
    }
    clearAgentTabTimer(state);
    agentTabTitles.delete(uriKey);
}

export function setAcpUiCustomEditorTabTitle(uri: Uri, title: string): void {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
        return;
    }
    const key = uri.toString();
    const existing = agentTabTitles.get(key);
    if (existing === undefined) {
        agentTabTitles.set(key, {
            baseTitle: trimmed,
            indicator: null,
            animate: true,
            frame: 0,
            timer: undefined,
        });
    } else {
        existing.baseTitle = trimmed;
    }
    paintAgentTabTitle(key);
}

/** Applies the Cursor agent monochrome status mark on the editor tab. */
export function setAcpUiCustomEditorTabActivity(
    uri: Uri,
    indicator: AgentTabIndicator | null,
    animate: boolean,
): void {
    const key = uri.toString();
    const panel = panelsByDocumentUri.get(key);
    if (panel === undefined) {
        return;
    }
    let state = agentTabTitles.get(key);
    if (state === undefined) {
        state = {
            baseTitle: panel.title,
            indicator: null,
            animate: true,
            frame: 0,
            timer: undefined,
        };
        agentTabTitles.set(key, state);
    }
    if (state.indicator === indicator && state.animate === animate) {
        return;
    }
    state.indicator = indicator;
    state.animate = animate;
    state.frame = 0;
    clearAgentTabTimer(state);
    syncAgentTabTimer(key, state);
    paintAgentTabTitle(key);
}

export function moveAcpUiCustomEditorUri(from: Uri, to: Uri): void {
    const fromKey = from.toString();
    const toKey = to.toString();
    if (fromKey === toKey) {
        return;
    }
    const panel = panelsByDocumentUri.get(fromKey);
    if (panel !== undefined) {
        panelsByDocumentUri.delete(fromKey);
        panelsByDocumentUri.set(toKey, panel);
    }
    const tabTitle = agentTabTitles.get(fromKey);
    if (tabTitle !== undefined) {
        agentTabTitles.delete(fromKey);
        clearAgentTabTimer(tabTitle);
        tabTitle.timer = undefined;
        agentTabTitles.set(toKey, tabTitle);
        syncAgentTabTimer(toKey, tabTitle);
    }
    const controller = controllersByDocumentUri.get(fromKey);
    if (controller !== undefined) {
        controllersByDocumentUri.delete(fromKey);
        controllersByDocumentUri.set(toKey, controller);
    }
}

export function setAcpUiCustomEditorRefreshHandler(refreshChatsList: () => void): void {
    refreshChatsListHandler = refreshChatsList;
}

/**
 * Custom editor for `.acp` session files: hosts the ACP UI webview and persists events.
 */
export class AcpUiCustomEditorProvider implements CustomTextEditorProvider {
    constructor(private readonly context: ExtensionContext) {}

    async resolveCustomTextEditor(
        document: TextDocument,
        webviewPanel: WebviewPanel,
        _token: CancellationToken,
    ): Promise<void> {
        const parsed = parseSessionFile(document.getText());
        if (parsed.header === null) {
            webviewPanel.webview.html =
                "<!DOCTYPE html><html><body><p>Invalid ACP UI session file: missing header.</p></body></html>";
            return;
        }

        const sessionUri = await ensureSessionFileNamedById(
            this.context,
            document.uri,
            parsed.header.id,
        );
        if (sessionUri.toString() !== document.uri.toString()) {
            moveAcpUiCustomEditorUri(document.uri, sessionUri);
        }
        updateAcpUiSessionFileUri(parsed.header.id, sessionUri);
        const sessionDocument =
            sessionUri.toString() === document.uri.toString()
                ? document
                : await workspace.openTextDocument(sessionUri);

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };
        for (const [key, panel] of panelsByDocumentUri.entries()) {
            if (panel === webviewPanel) {
                const existing = controllersByDocumentUri.get(key);
                existing?.dispose();
                controllersByDocumentUri.delete(key);
                panelsByDocumentUri.delete(key);
                break;
            }
        }

        webviewPanel.webview.html = getAcpUiWebviewHtml(
            this.context.extensionUri,
            webviewPanel.webview,
        );
        webviewPanel.iconPath = acpUiPanelTabIcon;

        const uriKey = sessionDocument.uri.toString();
        const boundController = controllersByDocumentUri.get(uriKey);
        if (boundController !== undefined) {
            boundController.dispose();
            controllersByDocumentUri.delete(uriKey);
            panelsByDocumentUri.delete(uriKey);
        }

        const controller = new AcpUiSessionController({
            context: this.context,
            document: sessionDocument,
            webview: webviewPanel.webview,
            refreshChatsList: refreshChatsListHandler,
        });
        controllersByDocumentUri.set(uriKey, controller);
        panelsByDocumentUri.set(uriKey, webviewPanel);
        setAcpUiCustomEditorTabTitle(sessionDocument.uri, parsed.header.title);
        controller.activate();

        webviewPanel.onDidDispose(() => {
            controllersByDocumentUri.delete(uriKey);
            panelsByDocumentUri.delete(uriKey);
            disposeAgentTabTitle(uriKey);
            controller.dispose();
        });
    }
}

export function registerAcpUiCustomEditorProvider(context: ExtensionContext): void {
    context.subscriptions.push(
        window.registerCustomEditorProvider(
            acpUiCustomEditorViewType,
            new AcpUiCustomEditorProvider(context),
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
            },
        ),
    );
}
