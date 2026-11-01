import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
    commands,
    Uri,
    workspace,
    type ExtensionContext,
    type TextDocument,
    type WebviewPanel,
} from "vscode";
import { MarkdownInlineProvider } from "./MarkdownInlineProvider";

const mutableWorkspace = workspace as unknown as {
    onDidChangeTextDocument: ReturnType<typeof vi.fn>;
};

function bootFrom(html: string): {
    readonly: boolean;
    content: string;
    diff?: { kind: string; removedBlocks: { text: string }[]; lines: number[] };
} {
    const match = /id="inline-md-state" content="([^"]*)"/.exec(html);
    if (!match?.[1]) {
        throw new Error("Missing editor state");
    }
    return JSON.parse(decodeURIComponent(match[1])) as {
        readonly: boolean;
        content: string;
        diff?: { kind: string; removedBlocks: { text: string }[]; lines: number[] };
    };
}

function textDocument(uri: ReturnType<typeof Uri.file>, text: string): TextDocument {
    return {
        uri,
        version: 1,
        getText: () => text,
    } as TextDocument;
}

function panel(): { html: string[]; view: WebviewPanel } {
    const html: string[] = [];
    const view = {
        viewColumn: 1,
        active: true,
        dispose: vi.fn(),
        onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
        webview: {
            options: {},
            cspSource: "csp",
            asWebviewUri: () => ({ toString: () => "vscode-webview://editor" }),
            set html(value: string) {
                html.push(value);
            },
            onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
            postMessage: vi.fn(),
        },
    };
    return { html, view: view as unknown as WebviewPanel };
}

describe("MarkdownInlineProvider diff views", () => {
    beforeEach(() => {
        vi.mocked(commands.executeCommand).mockClear();
        mutableWorkspace.onDidChangeTextDocument.mockClear();
    });

    it("opens an inline diff on the modified file and keeps a removed line", async () => {
        const original = textDocument(
            Uri.from({ scheme: "git", path: "/proj/readme.md" }),
            "Keep\nGone\n",
        );
        const modified = textDocument(Uri.file("/proj/readme.md"), "Keep\n");
        const modifiedPanel = panel();

        await new MarkdownInlineProvider({
            extensionUri: Uri.file("/ext"),
        } as ExtensionContext).resolveCustomTextEditorInlineDiff(
            { original, modified },
            modifiedPanel.view,
            { isCancellationRequested: false, onCancellationRequested: vi.fn() },
        );

        const boot = bootFrom(modifiedPanel.html[0] ?? "");
        expect(boot.readonly).toBe(false);
        expect(boot.content).toContain("Keep");
        expect(boot.diff?.removedBlocks.map((block) => block.text)).toEqual(["Gone"]);
        expect(commands.executeCommand).not.toHaveBeenCalled();
    });

    it("opens both sides of a side-by-side diff and keeps the original read-only", async () => {
        const original = textDocument(
            Uri.from({ scheme: "git", path: "/proj/readme.md" }),
            "Before\n",
        );
        const modified = textDocument(Uri.file("/proj/readme.md"), "After\n");
        const originalPanel = panel();
        const modifiedPanel = panel();

        await new MarkdownInlineProvider({
            extensionUri: Uri.file("/ext"),
        } as ExtensionContext).resolveCustomTextEditorSideBySideDiff(
            { original, modified },
            { original: originalPanel.view, modified: modifiedPanel.view },
            { isCancellationRequested: false, onCancellationRequested: vi.fn() },
        );

        const originalBoot = bootFrom(originalPanel.html[0] ?? "");
        const modifiedBoot = bootFrom(modifiedPanel.html[0] ?? "");
        expect(originalBoot.readonly).toBe(true);
        expect(originalBoot.content).toContain("Before");
        expect(originalBoot.diff?.kind).toBe("removed");
        expect(modifiedBoot.readonly).toBe(false);
        expect(modifiedBoot.content).toContain("After");
        expect(modifiedBoot.diff?.kind).toBe("added");
        expect(commands.executeCommand).not.toHaveBeenCalled();
    });
});
