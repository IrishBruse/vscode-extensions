import { describe, expect, it, vi } from "vite-plus/test";
import type { AcpAgentConfig } from "../acp/config/vscodeSettingsAgents";

vi.mock("./acpUiActiveAgent", () => ({
    getActiveAgentConfig: () => ({ name: "Cursor", command: "cursor", args: [] }),
}));

vi.mock("./acpUiNoAgentsPrompt", () => ({
    promptNoAcpAgentsConfigured: vi.fn(),
}));

vi.mock("../acp/config/mergedAgents", () => ({
    getAcpAgentConfigsMerged: () =>
        [
            { name: "Cursor", command: "cursor", args: [] },
            { name: "Gemini", command: "gemini", args: [] },
        ] satisfies AcpAgentConfig[],
}));

vi.mock("../acp/config/vscodeSettingsAgents", () => ({
    getAcpAgentConfigsFromSettings: () => [{ name: "Cursor", command: "cursor", args: [] }],
}));

const showQuickPick = vi.fn();

vi.mock("vscode", () => ({
    commands: {
        executeCommand: vi.fn(),
    },
    window: {
        showQuickPick,
    },
    QuickPickItemKind: { Separator: -1 },
}));

describe("pickAcpAgentForNewChat", () => {
    it("always opens a client list and marks the default agent", async () => {
        const { pickAcpAgentForNewChat } = await import("./acpUiAgentPicker");
        showQuickPick.mockResolvedValueOnce({
            label: "$(package) Gemini",
            config: { name: "Gemini", command: "gemini", args: [] },
        });

        const picked = await pickAcpAgentForNewChat();

        expect(picked?.name).toBe("Gemini");
        expect(showQuickPick).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    label: expect.stringContaining("Cursor"),
                    description: "Default for the + button",
                }),
                expect.objectContaining({
                    label: expect.stringContaining("Gemini"),
                    description: "Open a new chat with this client",
                }),
            ]),
            expect.objectContaining({
                title: "New chat with ACP client",
            }),
        );
    });
});
