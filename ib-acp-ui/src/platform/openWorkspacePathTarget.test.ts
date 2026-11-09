import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const executeCommand = vi.fn(async (..._args: unknown[]) => undefined);

vi.mock("vscode", () => ({
    FileType: { File: 1, Directory: 2, Unknown: 0, SymbolicLink: 64 },
    ViewColumn: { Active: -1 },
    commands: { executeCommand },
    workspace: {
        fs: {
            stat: async () => {
                throw new Error("missing");
            },
        },
        getWorkspaceFolder: () => undefined,
    },
}));

const { openWorkspacePathTarget } = await import("./openWorkspacePathTarget");

describe("openWorkspacePathTarget", () => {
    beforeEach(() => {
        executeCommand.mockClear();
    });

    it("opens a markdown file outside the workspace as a normal editor file", async () => {
        const uri = {
            fsPath: "/home/econn/.cursor/plans/Thought block redesign-4084c8ed.plan.md",
            scheme: "file",
        };
        await openWorkspacePathTarget(uri as never, "auto");
        expect(executeCommand).toHaveBeenCalledWith("vscode.openWith", uri, "default", -1);
        const commands = executeCommand.mock.calls.map((call) => call[0]);
        expect(commands).not.toContain("revealFileInOS");
    });
});
