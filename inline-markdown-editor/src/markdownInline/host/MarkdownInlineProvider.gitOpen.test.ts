import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
    commands,
    Uri,
    window,
    workspace,
    type ExtensionContext,
    type TextDocument,
    type WebviewPanel,
} from "vscode";
import { MarkdownInlineProvider } from "./MarkdownInlineProvider";

const mutableWindow = window as unknown as {
    tabGroups: { all: { tabs: { input: unknown }[] }[] };
};
const mutableWorkspace = workspace as unknown as {
    textDocuments: { uri: unknown; getText: () => string }[];
};

describe("MarkdownInlineProvider git open", () => {
    beforeEach(() => {
        mutableWindow.tabGroups.all = [];
        mutableWorkspace.textDocuments = [];
        vi.mocked(commands.executeCommand).mockClear();
    });

    it("reopens a changed git diff side as the default editor and does not render", async () => {
        const modified = Uri.file("/proj/readme.md");
        const original = Uri.from({ scheme: "git", path: "/proj/readme.md" });
        mutableWorkspace.textDocuments = [
            { uri: modified, getText: () => "work" },
            { uri: original, getText: () => "head" },
        ];
        mutableWindow.tabGroups.all = [{ tabs: [{ input: { original, modified } }] }];

        const html: string[] = [];
        const panel = {
            viewColumn: 1,
            dispose: vi.fn(),
            webview: {
                set html(value: string) {
                    html.push(value);
                },
            },
        };

        await new MarkdownInlineProvider({} as ExtensionContext).resolveCustomTextEditor(
            { uri: modified } as TextDocument,
            panel as unknown as WebviewPanel,
            { isCancellationRequested: false, onCancellationRequested: vi.fn() },
        );

        expect(html).toEqual([]);
        expect(panel.dispose).toHaveBeenCalledOnce();
        expect(commands.executeCommand).toHaveBeenCalledWith(
            "vscode.openWith",
            modified,
            "default",
            {
                viewColumn: 1,
            },
        );
    });
});
