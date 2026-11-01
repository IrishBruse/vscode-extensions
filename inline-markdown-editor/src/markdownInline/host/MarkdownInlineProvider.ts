import {
    CancellationToken,
    CustomEditorDiffDocuments,
    CustomEditorSideBySideDiffWebviewPanels,
    CustomTextEditorProvider,
    ExtensionContext,
    Range,
    Selection,
    TextDocument,
    Uri,
    Webview,
    WebviewPanel,
    WorkspaceEdit,
    commands,
    env,
    window,
    workspace,
} from "vscode";
import { Commands } from "../../constants";
import {
    getMarkdownInlineEditorColors,
    markdownInlineEditorColorsCssVars,
} from "./markdownInlineEditorColors";
import {
    paintForModified,
    paintForOriginal,
    textLineChanges,
    type DiffPaint,
} from "../lib/diff/lineChanges";
import {
    openMarkdownWithRawEditor,
    shouldUseMarkdownCustomEditor,
} from "./shouldUseMarkdownCustomEditor";
import { isSkillMarkdownPath, prefixMarkdownForFastOpen } from "./webviewInitialState";

export const MARKDOWN_INLINE_VIEW_TYPE = "inline-markdown-editor.markdownInline";

function getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function clampOffset(offset: number, length: number): number {
    const whole = Math.trunc(offset);
    if (whole < 0) {
        return 0;
    }
    if (whole > length) {
        return length;
    }
    return whole;
}

class AuthenticatedWebview {
    readonly #messageSecret = crypto.randomUUID();

    constructor(readonly webview: Webview) {}

    get messageSecret(): string {
        return this.#messageSecret;
    }

    postMessage(message: object): Thenable<boolean> {
        return this.webview.postMessage({ ...message, messageSecret: this.#messageSecret });
    }
}

interface EditorBoot {
    readonly content: string;
    readonly documentVersion: number;
    readonly readOnly: boolean;
    readonly scrollSync: boolean;
    readonly diff?: DiffPaint;
}

function getEditorHtml(
    documentUri: Uri,
    webview: Webview,
    extensionUri: Uri,
    messageSecret: string,
    boot: EditorBoot,
): string {
    const mediaRoot = Uri.joinPath(extensionUri, "media", "markdownInline");
    const scriptUri = webview.asWebviewUri(Uri.joinPath(mediaRoot, "editor.js"));
    const styleUri = webview.asWebviewUri(Uri.joinPath(mediaRoot, "editor.css"));
    const workerUri = webview.asWebviewUri(Uri.joinPath(mediaRoot, "editor.worker.js"));
    const baseUri = webview.asWebviewUri(documentUri);
    const nonce = getNonce();
    const initialState = encodeURIComponent(
        JSON.stringify({
            content: boot.content,
            documentVersion: boot.documentVersion,
            readonly: boot.readOnly,
            scrollSync: boot.scrollSync,
            diff: boot.diff,
            documentUrl: baseUri.toString(),
            skillFrontMatter: isSkillMarkdownPath(documentUri.path),
        }),
    );
    const colorVars = markdownInlineEditorColorsCssVars(getMarkdownInlineEditorColors());

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}' ${webview.cspSource}; worker-src ${webview.cspSource};" />
    <meta name="inline-md-message-secret" content="${messageSecret}" />
    <meta name="inline-md-worker" content="${workerUri.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" />
    <meta id="inline-md-state" content="${initialState}" />
    <base href="${baseUri.toString()}" />
    <link rel="stylesheet" href="${styleUri.toString()}" />
    <style>
        :root {
            ${colorVars}
        }
    </style>
    <title>Inline Markdown (ib-utilities)</title>
</head>
<body>
    <div id="editor"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri.toString()}"></script>
</body>
</html>`;
}

async function openMarkdownLink(href: string, documentUri: Uri): Promise<void> {
    if (/^https?:\/\//i.test(href)) {
        await env.openExternal(Uri.parse(href));
        return;
    }

    const hashIndex = href.indexOf("#");
    const pathPart = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
    const fragment = hashIndex >= 0 ? href.slice(hashIndex + 1) : undefined;
    const baseDir = Uri.joinPath(documentUri, "..");
    const targetPath = pathPart.length > 0 ? pathPart : (documentUri.path.split("/").pop() ?? "");
    const target = Uri.joinPath(baseDir, ...targetPath.split("/").filter(Boolean));

    if (fragment) {
        const lineMatch = /^L(\d+)(?:,(\d+))?$/.exec(fragment);
        if (lineMatch) {
            const line = Math.max(0, Number(lineMatch[1]) - 1);
            const column = lineMatch[2] !== undefined ? Math.max(0, Number(lineMatch[2]) - 1) : 0;
            const doc = await workspace.openTextDocument(target);
            const editor = await window.showTextDocument(doc);
            const safeLine = Math.min(line, doc.lineCount - 1);
            const position = doc.lineAt(safeLine).range.start.with(undefined, column);
            editor.selection = new Selection(position, position);
            editor.revealRange(new Range(position, position));
            return;
        }
    }

    await commands.executeCommand("vscode.open", target);
}

export class MarkdownInlineProvider implements CustomTextEditorProvider {
    constructor(private readonly context: ExtensionContext) {}

    async resolveCustomTextEditor(
        document: TextDocument,
        webviewPanel: WebviewPanel,
        _token: CancellationToken,
    ): Promise<void> {
        let released = false;
        const releaseIfNotEditor = async () => {
            if (released || shouldUseMarkdownCustomEditor(document.uri)) {
                return false;
            }
            released = true;
            await openMarkdownWithRawEditor(document.uri, webviewPanel.viewColumn);
            webviewPanel.dispose();
            return true;
        };
        if (await releaseIfNotEditor()) {
            return;
        }

        this.openEditor(document, webviewPanel, {
            readOnly: false,
            scrollSync: false,
            releaseIfNotEditor,
        });
    }

    async resolveCustomTextEditorInlineDiff(
        documents: CustomEditorDiffDocuments<TextDocument>,
        webviewPanel: WebviewPanel,
        token: CancellationToken,
    ): Promise<void> {
        if (token.isCancellationRequested) {
            return;
        }
        const changes = () =>
            textLineChanges(documents.original.getText(), documents.modified.getText());
        this.openEditor(documents.modified, webviewPanel, {
            readOnly: false,
            scrollSync: false,
            alsoWatch: documents.original,
            diff: () => paintForModified(changes(), true),
        });
    }

    async resolveCustomTextEditorSideBySideDiff(
        documents: CustomEditorDiffDocuments<TextDocument>,
        webviewPanels: CustomEditorSideBySideDiffWebviewPanels,
        token: CancellationToken,
    ): Promise<void> {
        if (token.isCancellationRequested) {
            return;
        }
        const changes = () =>
            textLineChanges(documents.original.getText(), documents.modified.getText());
        const sides: {
            original?: { reveal(line: number): void };
            modified?: { reveal(line: number): void };
        } = {};
        let scrollFrom: "original" | "modified" | undefined;
        const relay = (role: "original" | "modified", line: number): void => {
            if (scrollFrom && scrollFrom !== role) {
                return;
            }
            scrollFrom = role;
            const current = changes();
            const mapped =
                role === "original"
                    ? (current.originalToModified[line] ?? line)
                    : (current.modifiedToOriginal[line] ?? line);
            const target = role === "original" ? sides.modified : sides.original;
            target?.reveal(mapped);
            setTimeout(() => {
                if (scrollFrom === role) {
                    scrollFrom = undefined;
                }
            }, 80);
        };
        sides.original = this.openEditor(documents.original, webviewPanels.original, {
            readOnly: true,
            scrollSync: true,
            alsoWatch: documents.modified,
            diff: () => paintForOriginal(changes()),
            onScroll: (line) => {
                relay("original", line);
            },
        });
        sides.modified = this.openEditor(documents.modified, webviewPanels.modified, {
            readOnly: false,
            scrollSync: true,
            alsoWatch: documents.original,
            diff: () => paintForModified(changes(), false),
            onScroll: (line) => {
                relay("modified", line);
            },
        });
    }

    private openEditor(
        document: TextDocument,
        webviewPanel: WebviewPanel,
        options: {
            readonly readOnly: boolean;
            readonly scrollSync: boolean;
            readonly diff?: () => DiffPaint;
            readonly alsoWatch?: TextDocument;
            readonly onScroll?: (line: number) => void;
            readonly releaseIfNotEditor?: () => Promise<boolean>;
        },
    ): { reveal(line: number): void } {
        const mediaRoot = Uri.joinPath(this.context.extensionUri, "media", "markdownInline");
        const editorWebview = new AuthenticatedWebview(webviewPanel.webview);
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                mediaRoot,
                Uri.joinPath(document.uri, ".."),
                ...(workspaceFolder ? [workspaceFolder.uri] : []),
            ],
        };

        let isUpdatingFromWebview = false;
        let editQueue = Promise.resolve();
        let webviewReady = false;
        let htmlContentIsPrefix = false;

        const renderHtml = () => {
            webviewReady = false;
            const text = document.getText();
            const prefix = options.diff ? text : prefixMarkdownForFastOpen(text);
            htmlContentIsPrefix = prefix.length < text.length;
            webviewPanel.webview.html = getEditorHtml(
                document.uri,
                webviewPanel.webview,
                this.context.extensionUri,
                editorWebview.messageSecret,
                {
                    content: prefix,
                    documentVersion: document.version,
                    readOnly: options.readOnly,
                    scrollSync: options.scrollSync,
                    diff: options.diff?.(),
                },
            );
        };

        renderHtml();

        const releaseTimers = options.releaseIfNotEditor
            ? [0, 50, 200].map((delay) =>
                  setTimeout(() => {
                      void options.releaseIfNotEditor?.();
                  }, delay),
              )
            : [];
        const disposables = [
            {
                dispose: () => {
                    for (const timer of releaseTimers) {
                        clearTimeout(timer);
                    }
                },
            },
            ...(options.releaseIfNotEditor
                ? [
                      window.tabGroups.onDidChangeTabs(() => {
                          void options.releaseIfNotEditor?.();
                      }),
                  ]
                : []),
            editorWebview.webview.onDidReceiveMessage(async (message) => {
                if (
                    !message ||
                    typeof message !== "object" ||
                    message.messageSecret !== editorWebview.messageSecret
                ) {
                    return;
                }

                switch (message.type) {
                    case "ready": {
                        webviewReady = true;
                        if (htmlContentIsPrefix || message.documentVersion !== document.version) {
                            await editorWebview.postMessage({
                                type: "update",
                                content: document.getText(),
                                diff: options.diff?.(),
                            });
                        }
                        break;
                    }
                    case "scroll": {
                        if (typeof message.line === "number") {
                            options.onScroll?.(message.line);
                        }
                        break;
                    }
                    case "history": {
                        if (message.command === "undo" || message.command === "redo") {
                            await editQueue;
                            if (webviewPanel.active) {
                                await commands.executeCommand(message.command);
                            }
                        }
                        break;
                    }
                    case "openLink": {
                        if (typeof message.href === "string") {
                            await openMarkdownLink(message.href, document.uri);
                        }
                        break;
                    }
                    case "openMermaidPreview": {
                        if (
                            typeof message.openLine !== "number" ||
                            !Number.isFinite(message.openLine)
                        ) {
                            break;
                        }
                        await commands.executeCommand(
                            Commands.OpenMermaidMarkdownPreview,
                            document.uri.toString(),
                            message.openLine,
                        );
                        break;
                    }
                    case "edit": {
                        if (options.readOnly) {
                            break;
                        }
                        const startOffset = message.start;
                        const endOffset = message.endExclusive;
                        const text = message.text;
                        if (
                            typeof startOffset !== "number" ||
                            !Number.isFinite(startOffset) ||
                            typeof endOffset !== "number" ||
                            !Number.isFinite(endOffset) ||
                            typeof text !== "string"
                        ) {
                            break;
                        }
                        editQueue = editQueue.then(async () => {
                            const length = document.getText().length;
                            const start = clampOffset(startOffset, length);
                            const endExclusive = clampOffset(endOffset, length);
                            const edit = new WorkspaceEdit();
                            edit.replace(
                                document.uri,
                                new Range(
                                    document.positionAt(Math.min(start, endExclusive)),
                                    document.positionAt(Math.max(start, endExclusive)),
                                ),
                                text,
                            );
                            isUpdatingFromWebview = true;
                            try {
                                await workspace.applyEdit(edit);
                            } finally {
                                isUpdatingFromWebview = false;
                            }
                        });
                        await editQueue;
                        break;
                    }
                }
            }),
            workspace.onDidChangeTextDocument((event) => {
                const uri = event.document.uri.toString();
                const own = uri === document.uri.toString();
                const peer = options.alsoWatch ? uri === options.alsoWatch.uri.toString() : false;
                if ((!own && !peer) || (own && isUpdatingFromWebview) || !webviewReady) {
                    return;
                }
                if (own) {
                    void editorWebview.postMessage({
                        type: "update",
                        content: document.getText(),
                        diff: options.diff?.(),
                    });
                    return;
                }
                void editorWebview.postMessage({
                    type: "diff",
                    diff: options.diff?.(),
                });
            }),
            webviewPanel.onDidDispose(() => {
                for (const disposable of disposables) {
                    disposable.dispose();
                }
            }),
        ];

        return {
            reveal(line: number) {
                void editorWebview.postMessage({ type: "reveal", line });
            },
        };
    }
}

export function registerMarkdownInlineEditor(context: ExtensionContext): void {
    context.subscriptions.push(
        window.registerCustomEditorProvider(
            MARKDOWN_INLINE_VIEW_TYPE,
            new MarkdownInlineProvider(context),
            {
                webviewOptions: { retainContextWhenHidden: true },
            },
        ),
    );
}
