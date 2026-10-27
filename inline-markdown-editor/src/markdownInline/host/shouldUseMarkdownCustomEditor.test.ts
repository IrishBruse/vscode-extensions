import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { commands, Uri, window, workspace } from "vscode";
import {
    isDirectMarkdownEditUri,
    openMarkdownWithRawEditor,
    shouldUseMarkdownCustomEditor,
} from "./shouldUseMarkdownCustomEditor";

const mutableWindow = window as unknown as {
    tabGroups: { all: { tabs: { input: unknown }[] }[] };
};
const mutableWorkspace = workspace as unknown as {
    textDocuments: { uri: unknown; getText: () => string }[];
};

function doc(uri: Uri, text = ""): { uri: Uri; getText: () => string } {
    return { uri, getText: () => text };
}

describe("shouldUseMarkdownCustomEditor", () => {
    beforeEach(() => {
        mutableWindow.tabGroups.all = [];
        mutableWorkspace.textDocuments = [];
        vi.mocked(commands.executeCommand).mockClear();
    });

    describe("isDirectMarkdownEditUri", () => {
        it("allows workspace and untitled documents", () => {
            expect(isDirectMarkdownEditUri(Uri.file("/proj/readme.md"))).toBe(true);
            expect(
                isDirectMarkdownEditUri(Uri.from({ scheme: "untitled", path: "/Untitled-1" })),
            ).toBe(true);
            expect(
                isDirectMarkdownEditUri(Uri.from({ scheme: "vscode-remote", path: "/home/a.md" })),
            ).toBe(true);
        });

        it("rejects git and history schemes used in diffs", () => {
            expect(
                isDirectMarkdownEditUri(Uri.from({ scheme: "git", path: "/proj/readme.md" })),
            ).toBe(false);
            expect(
                isDirectMarkdownEditUri(Uri.from({ scheme: "gitlens", path: "/proj/readme.md" })),
            ).toBe(false);
            expect(
                isDirectMarkdownEditUri(
                    Uri.from({ scheme: "vscode-local-history", path: "/proj/readme.md" }),
                ),
            ).toBe(false);
        });
    });

    it("rejects a file URI that is open in a text diff tab with changes", () => {
        const original = Uri.file("/proj/old.md");
        const modified = Uri.file("/proj/readme.md");
        mutableWorkspace.textDocuments = [doc(original, "old"), doc(modified, "new")];
        mutableWindow.tabGroups.all = [
            {
                tabs: [{ input: { original, modified } }],
            },
        ];

        expect(shouldUseMarkdownCustomEditor(modified)).toBe(false);
        expect(shouldUseMarkdownCustomEditor(original)).toBe(false);
        expect(shouldUseMarkdownCustomEditor(Uri.file("/proj/other.md"))).toBe(true);
    });

    it("keeps the custom editor for a diff tab whose sides are identical", () => {
        const original = Uri.from({ scheme: "git", path: "/proj/readme.md" });
        const modified = Uri.file("/proj/readme.md");
        mutableWorkspace.textDocuments = [doc(original, "same"), doc(modified, "same")];
        mutableWindow.tabGroups.all = [
            {
                tabs: [{ input: { original, modified } }],
            },
        ];

        expect(shouldUseMarkdownCustomEditor(modified)).toBe(true);
    });

    it("rejects a file URI opened in a multi-file compare with changes", () => {
        const modified = Uri.file("/proj/readme.md");
        const original = Uri.file("/proj/old.md");
        mutableWorkspace.textDocuments = [doc(original, "a"), doc(modified, "b")];
        mutableWindow.tabGroups.all = [
            {
                tabs: [{ input: { resources: [{ original, modified }] } }],
            },
        ];

        expect(shouldUseMarkdownCustomEditor(modified)).toBe(false);
    });

    it("rejects a file URI opened in a merge editor with changes", () => {
        const result = Uri.file("/proj/readme.md");
        const base = Uri.from({ scheme: "git", path: "/proj/readme.md" });
        mutableWorkspace.textDocuments = [doc(base, "base"), doc(result, "result")];
        mutableWindow.tabGroups.all = [
            {
                tabs: [
                    {
                        input: {
                            base,
                            input1: Uri.from({
                                scheme: "git",
                                path: "/proj/readme.md",
                                query: "ours",
                            }),
                            input2: Uri.from({
                                scheme: "git",
                                path: "/proj/readme.md",
                                query: "theirs",
                            }),
                            result,
                        },
                    },
                ],
            },
        ];

        expect(shouldUseMarkdownCustomEditor(result)).toBe(false);
    });

    it("rejects a file URI listed in a multi-diff tab with changes", () => {
        const modified = Uri.file("/proj/readme.md");
        const original = Uri.from({ scheme: "git", path: "/proj/readme.md" });
        mutableWorkspace.textDocuments = [doc(original, "head"), doc(modified, "work")];
        mutableWindow.tabGroups.all = [
            {
                tabs: [
                    {
                        input: {
                            textDiffs: [{ original, modified }],
                        },
                    },
                ],
            },
        ];

        expect(shouldUseMarkdownCustomEditor(modified)).toBe(false);
    });

    it("keeps the custom editor when a git document is open but there is no diff tab", () => {
        const modified = Uri.file("/proj/readme.md");
        mutableWorkspace.textDocuments = [
            doc(modified, "work"),
            doc(
                Uri.from({
                    scheme: "git",
                    path: "/proj/readme.md",
                    query: '{"path":"/proj/readme.md","ref":"~"}',
                }),
                "head",
            ),
        ];

        expect(shouldUseMarkdownCustomEditor(modified)).toBe(true);
        expect(shouldUseMarkdownCustomEditor(Uri.file("/proj/other.md"))).toBe(true);
    });

    it("opens the default text editor for a raw reopen", async () => {
        const modified = Uri.file("/proj/readme.md");

        await openMarkdownWithRawEditor(modified);

        expect(commands.executeCommand).toHaveBeenCalledWith(
            "vscode.openWith",
            modified,
            "default",
            undefined,
        );
    });
});
