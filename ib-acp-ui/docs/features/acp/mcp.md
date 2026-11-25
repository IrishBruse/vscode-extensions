# MCP

## User facing

When a chat connects, ACP UI reads your MCP servers and gives them to the agent.
The agent can then use those tools.
Servers come from `~/.cursor/mcp.json`, the workspace `.vscode/mcp.json`, the workspace `.cursor/mcp.json`, and the `ib-acp-ui.mcpServers` setting.
A later source replaces a server with the same name.
The setting replaces the files.
`${workspaceFolder}`, `${userHome}`, and `${env:NAME}` are filled in before the agent receives the server.
The MCP tab lists each server, the command or URL, and whether the agent received it.
A disabled server stays in the list and is not sent.
HTTP and SSE servers are sent only when the agent accepts that kind.
Environment values and header values stay out of the tab.

## Implementation

### Config

[loadCursorMcpReport](../../../src/acp/mcp/vscodeMcpServers.ts#L22-L59) reads the user file, each workspace file, then `ib-acp-ui.mcpServers`.
[mcpReportFromDocuments](../../../src/acp/mcp/cursorMcpConfig.ts#L253-L281) maps Cursor `mcpServers` and VS Code `servers` onto ACP stdio, HTTP, and SSE servers.
A missing command or URL, `disabled: true`, or an unadvertised HTTP or SSE transport is listed and not forwarded.
Stdio is always forwarded.

### Session setup

[mcpServersForSession](../../../src/acp/session/acpSessionBridge.ts#L1055-L1063) posts the tab rows, then passes the forwarded list into session setup.
[newSession](../../../src/acp/infrastructure/acpAgentProcess.ts#L495-L501) and [loadSession](../../../src/acp/infrastructure/acpAgentProcess.ts#L467-L483) send that list on `session/new` and `session/load`.

### MCP tab

[AcpUiApp](../../../webview/acp-ui/src/AcpUiApp.tsx#L621-L630) adds the MCP tab next to ACP.
[chatReducer](../../../webview/acp-ui/src/chatReducer.ts#L2465-L2470) stores `mcpServers`.
[McpServersView](../../../webview/acp-ui/src/components/acp/mcp/McpServersView.tsx#L5-L45) renders the name, transport, command or URL, source, and status.

Protocol: [session setup](../../acp/protocol/v1/session-setup.mdx).
