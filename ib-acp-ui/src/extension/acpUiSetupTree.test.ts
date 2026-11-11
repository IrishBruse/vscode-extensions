import { describe, expect, it } from "vite-plus/test";
import {
    buildAcpUiSetupTree,
    manualClientsAfterAdd,
    manualClientsAfterEdit,
    manualClientsAfterRemove,
    parseClientArgsInput,
    setupClientsFromConfigs,
    type AcpUiSetupNode,
} from "./acpUiSetupTree";

const manual = {
    name: "Local",
    command: "my-agent",
    args: ["--acp"],
    env: { TOKEN: "x" },
};
const cursor = {
    name: "Cursor",
    command: "cursor-agent",
    args: ["acp"],
    registryId: "cursor",
};

function flatten(nodes: AcpUiSetupNode[]): AcpUiSetupNode[] {
    return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

describe("buildAcpUiSetupTree", () => {
    it("shows clients, runtime, and the open chat instead of previous chats", () => {
        const tree = buildAcpUiSetupTree({
            clients: setupClientsFromConfigs([manual], [manual, cursor], "Cursor"),
            activeClientName: "Cursor",
            workspacePath: "/work/app",
            openChat: {
                title: "CLI Skill Extension",
                agentName: "Cursor",
                localSessionId: "local-1",
                runtimeSessionId: "run-1",
                filePath: "/work/app/chats/local-1/cli.acp",
                connection: "disconnected",
                connectionError: 'ACP agent "Cursor" stopped.\nExit code: 1.',
            },
        });

        const labels = flatten(tree).map((node) => node.label);
        expect(
            labels.filter((label) => ["Clients", "Runtime", "Open chat"].includes(label)),
        ).toEqual(["Clients", "Runtime", "Open chat"]);
        expect(labels).not.toContain("Go Project Architect");
        expect(labels).not.toContain("CLI Skill Extension");
        expect(
            flatten(tree).every((node) =>
                ["section", "clientSettings", "clientRegistry", "action", "fact"].includes(
                    node.contextValue,
                ),
            ),
        ).toBe(true);

        expect(labels).not.toContain("Browse registry…");
        expect(tree.every((node) => node.children.length === 0 && node.collapsible === false)).toBe(
            true,
        );
        const local = tree.find((node) => node.label === "Local");
        const cursorNode = tree.find((node) => node.label === "Cursor");
        expect(local).toMatchObject({
            contextValue: "clientSettings",
            description: "my-agent --acp",
        });
        expect(cursorNode).toMatchObject({
            contextValue: "clientRegistry",
            description: "active · cursor-agent acp",
            registryId: "cursor",
        });

        expect(
            tree
                .filter((node) => node.id.startsWith("runtime:"))
                .map((node) => [node.label, node.description]),
        ).toEqual([
            ["New chats use", "Cursor"],
            ["Workspace", "/work/app"],
        ]);
        expect(
            tree
                .filter((node) => node.id.startsWith("chat:") && node.id !== "chat:empty")
                .map((node) => [node.label, node.description]),
        ).toEqual([
            ["Title", "CLI Skill Extension"],
            ["Client", "Cursor"],
            ["File", "/work/app/chats/local-1/cli.acp"],
            ["Local id", "local-1"],
            ["Runtime session", "run-1"],
            ["ACP connection", "Disconnected"],
            ["Error", 'ACP agent "Cursor" stopped.\nExit code: 1.'],
        ]);
    });

    it("shows an empty open chat when none is open", () => {
        const tree = buildAcpUiSetupTree({ clients: [] });
        expect(tree.map((node) => node.label)).toEqual([
            "Clients",
            "No clients yet",
            "Add client…",
            "Runtime",
            "New chats use",
            "Workspace",
            "Open chat",
            "No chat open",
        ]);
        expect(tree.find((node) => node.id === "runtime:active-client")?.description).toBe("None");
        expect(tree.find((node) => node.id === "runtime:workspace")?.description).toBe(
            "No folder open",
        );
    });
});

describe("manual client edits", () => {
    it("adds, edits, and removes settings clients", () => {
        const added = manualClientsAfterAdd([], manual);
        expect(added).toEqual([manual]);
        const replaced = manualClientsAfterAdd(added, { ...manual, command: "other" });
        expect(replaced).toEqual([{ ...manual, command: "other" }]);
        const edited = manualClientsAfterEdit(replaced, "Local", {
            command: "agent",
            args: ["--acp"],
        });
        expect(edited[0]).toMatchObject({
            name: "Local",
            command: "agent",
            args: ["--acp"],
            env: { TOKEN: "x" },
        });
        expect(manualClientsAfterRemove(edited, "Local")).toEqual([]);
        expect(parseClientArgsInput(" --acp  --foo ")).toEqual(["--acp", "--foo"]);
        expect(parseClientArgsInput("  ")).toEqual([]);
    });
});
