import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type * as acp from "@agentclientprotocol/sdk";
import { workspace } from "vscode";
import { formatPathWithTilde } from "../../platform/pathDisplay";
import {
    type McpConfigDocument,
    type McpForwardReport,
    mcpReportFromDocuments,
} from "./cursorMcpConfig";

async function readOptionalFile(path: string): Promise<string | undefined> {
    try {
        return await readFile(path, "utf8");
    } catch {
        return undefined;
    }
}

/** Reads user, workspace, and settings MCP config for one agent session. */
export async function loadCursorMcpReport(
    capabilities: acp.McpCapabilities | undefined,
): Promise<McpForwardReport> {
    const home = homedir();
    const folders = workspace.workspaceFolders ?? [];
    const documents: McpConfigDocument[] = [];
    const userPath = join(home, ".cursor", "mcp.json");
    documents.push({
        source: formatPathWithTilde(userPath, home),
        text: await readOptionalFile(userPath),
    });
    for (const folder of folders) {
        const root = folder.uri.fsPath;
        const vscodePath = join(root, ".vscode", "mcp.json");
        const cursorPath = join(root, ".cursor", "mcp.json");
        documents.push({
            source: formatPathWithTilde(vscodePath, home),
            text: await readOptionalFile(vscodePath),
        });
        documents.push({
            source: formatPathWithTilde(cursorPath, home),
            text: await readOptionalFile(cursorPath),
        });
    }
    documents.push({
        source: "Settings",
        value: workspace.getConfiguration().get<unknown>("ib-acp-ui.mcpServers", {}),
    });
    return mcpReportFromDocuments(
        documents,
        {
            workspaceFolder: folders[0]?.uri.fsPath,
            userHome: home,
            env: process.env,
        },
        capabilities,
    );
}
