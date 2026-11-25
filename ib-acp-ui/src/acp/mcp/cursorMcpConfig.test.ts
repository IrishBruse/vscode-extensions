import { describe, expect, it } from "vite-plus/test";
import { mcpReportFromDocuments } from "./cursorMcpConfig";

const context = {
    workspaceFolder: "/work",
    userHome: "/home/me",
    env: { TOKEN: "secret" },
};

describe("mcpReportFromDocuments", () => {
    it("forwards stdio servers and hides env values", () => {
        const report = mcpReportFromDocuments(
            [
                {
                    source: "~/.cursor/mcp.json",
                    text: JSON.stringify({
                        mcpServers: {
                            github: {
                                command: "npx",
                                args: ["-y", "server"],
                                env: { TOKEN: "${env:TOKEN}" },
                            },
                        },
                    }),
                },
            ],
            context,
            undefined,
        );
        expect(report.servers).toEqual([
            {
                name: "github",
                transport: "stdio",
                detail: "npx -y server",
                source: "~/.cursor/mcp.json",
                forwarded: true,
            },
        ]);
        expect(report.forwarded).toEqual([
            {
                name: "github",
                command: "npx",
                args: ["-y", "server"],
                env: [{ name: "TOKEN", value: "secret" }],
            },
        ]);
    });

    it("lets a project file replace a user server with the same name", () => {
        const report = mcpReportFromDocuments(
            [
                {
                    source: "user",
                    text: JSON.stringify({
                        mcpServers: { docs: { command: "old", args: [] } },
                    }),
                },
                {
                    source: "project",
                    text: JSON.stringify({
                        mcpServers: { docs: { command: "new", args: ["--stdio"] } },
                    }),
                },
            ],
            context,
            undefined,
        );
        expect(report.servers[0]?.detail).toBe("new --stdio");
        expect(report.servers[0]?.source).toBe("project");
    });

    it("skips HTTP until the agent accepts it", () => {
        const documents = [
            {
                source: ".cursor/mcp.json",
                text: JSON.stringify({
                    mcpServers: {
                        remote: { url: "https://example.com/${env:TOKEN}" },
                        events: { type: "sse", url: "https://example.com/sse" },
                        off: { command: "tool", disabled: true },
                    },
                }),
            },
        ];
        const blocked = mcpReportFromDocuments(documents, context, undefined);
        expect(blocked.forwarded).toEqual([]);
        expect(blocked.servers.map((server) => server.skipReason)).toEqual([
            "This agent does not accept HTTP MCP servers",
            "This agent does not accept SSE MCP servers",
            "Disabled",
        ]);
        expect(blocked.servers[0]?.detail).toBe("https://example.com/${env:TOKEN}");

        const allowed = mcpReportFromDocuments(documents, context, { http: true, sse: true });
        expect(allowed.forwarded).toEqual([
            {
                type: "http",
                name: "remote",
                url: "https://example.com/secret",
                headers: [],
            },
            {
                type: "sse",
                name: "events",
                url: "https://example.com/sse",
                headers: [],
            },
        ]);
    });

    it("reads a settings map and a VS Code servers map", () => {
        const report = mcpReportFromDocuments(
            [
                {
                    source: ".vscode/mcp.json",
                    text: JSON.stringify({
                        servers: { local: { command: "${workspaceFolder}/bin/mcp", args: [] } },
                    }),
                },
                {
                    source: "Settings",
                    value: { extra: { url: "https://settings.example/mcp" } },
                },
            ],
            context,
            { http: true },
        );
        expect(report.forwarded[0]).toMatchObject({
            name: "local",
            command: "/work/bin/mcp",
        });
        expect(report.forwarded[1]).toMatchObject({
            type: "http",
            name: "extra",
            url: "https://settings.example/mcp",
        });
    });

    it("reports invalid JSON and ignores a missing file", () => {
        const report = mcpReportFromDocuments(
            [{ source: "~/.cursor/mcp.json" }, { source: ".cursor/mcp.json", text: "{" }],
            context,
            undefined,
        );
        expect(report.servers).toEqual([]);
        expect(report.note).toBe("Could not read .cursor/mcp.json");
    });
});
