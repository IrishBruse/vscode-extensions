# Terminal

## User facing

Agents that use ACP `terminal/*` methods can run shell commands through ACP UI.
Commands open in a VS Code integrated terminal panel named `ACP: <command>` while stdout and stderr stream back to the agent.
Agents that support the Zed `_meta.terminal_output` convention can also attach live terminal output to tool cards in the chat trace.

Tool display for terminal-style tool calls still appears in the chat trace from `session/update` payloads regardless of which backend ran the command.

## Implementation

### Capabilities

[buildAcpClientCapabilities](../../../src/acp/infrastructure/acpAgentProcess.ts#L158-L176) sets `terminal: true` and `_meta.terminal_output: true` on every `initialize`.
That matches Zed parity for agents that gate rich terminal rendering on the meta flag.

### Client handlers

[AcpAgentProcess](../../../src/acp/infrastructure/acpAgentProcess.ts#L300-L318) wires SDK `createTerminal`, `terminalOutput`, `waitForTerminalExit`, `killTerminal`, and `releaseTerminal` to [AcpHostTerminal](../../../src/acp/ports/hostTerminal.ts).

Production VS Code wiring lives in [createVscodeAcpHostTerminal](../../../src/platform/vscode/vscodeAcpHostTerminal.ts).
It spawns the child process in [AcpHostTerminalManager](../../../src/acp/infrastructure/acpHostTerminalManager.ts), captures output for the protocol, and mirrors bytes to a [Pseudoterminal](../../../src/platform/vscode/vscodeAcpHostTerminal.ts#L28-L41) via `vscode.window.createTerminal`.
The playground uses [createNodeAcpHostTerminal](../../../src/platform/node/nodeAcpHostTerminal.ts) (spawn only, no panel).

Output is truncated from the front when it exceeds `outputByteLimit` (default 1 MiB) using [truncateTerminalOutput](../../../src/acp/infrastructure/terminalOutputBuffer.ts).

Protocol: [terminals](../../acp/protocol/v1/terminals.mdx).
Related: [authentication](./authentication.md) for terminal auth, [client](./client.md) for capability advertisement.
