# Agents

## User facing

ACP UI talks to one or more ACP-capable agent processes.
Install agents from the official registry (**Browse Agent Registry**), or add advanced manual entries in `ib-acp-ui.agents` (display name, executable, optional args/env, optional `authMethodId`).

Manual settings override registry installs when the display name matches.
There are no built-in default agents; install from the registry on first use.

Add a manual client with **Add ACP client**.
Choose the client for new chats with **Select Active ACP Agent**.
That choice is stored in extension state, outside `settings.json`.
On an open `.acp` editor tab, the title bar shows a **New Chat** split control (`+ ▾`): the plus creates with the active client, and the chevron offers **New Chat with Agent…**.
The selected client is used for new chats.
Each open chat remembers which agent it was created with via the session file header.
The composer does not switch agents.

## Implementation

### Settings and merge

[getAcpAgentConfigsFromSettings](../../../src/acp/config/vscodeSettingsAgents.ts#L9-L19) reads manual `ib-acp-ui.agents` only.
[getAcpAgentConfigsMerged](../../../src/acp/config/mergedAgents.ts#L8-L10) combines those with installed registry agents.
[parseAcpAgentSpawnConfig](../../../src/acp/domain/agentSpawnConfig.ts) validates each entry.

[isCursorAcpAgent](../../../src/acp/domain/agentSpawnConfig.ts) detects Cursor spawn configs for capability and UI gates (including `registryId === "cursor"`).

### Active agent selection

[initializeAcpUiActiveAgent](../../../src/extension/acpUiActiveAgent.ts) binds global state.
[getActiveAgentConfig](../../../src/extension/acpUiActiveAgent.ts) returns the stored name or the first merged agent.
[setActiveAgentName](../../../src/extension/acpUiActiveAgent.ts) persists the client chosen for new chats.

[pickAcpAgentConfig](../../../src/extension/acpUiAgentPicker.ts) shows a quick pick over the merged list, with a **Browse Agent Registry** entry.
[selectClientByName](../../../src/extension/acpUiSessionsView.ts#L156-L164) sets the client for new chats.
[selectActiveAgent](../../../src/extension/acpUiSessionsView.ts#L166-L189) updates it from **Select Active ACP Agent**.
[addClient](../../../src/extension/acpUiSessionsView.ts#L191-L218) writes a manual client.
`.acp` tabs contribute new-chat commands to `editor/title` (`navigation` group with `alt`) so VS Code renders the `+ ▾` split button.

### Per-session agent binding

Session file headers store `agentName`.
[acpUiSessionController](../../../src/extension/acpUiSessionController.ts) resolves the agent config when a chat opens and sends `lockSessionAgent: true` on init.

### Process spawn

[AcpAgentProcess.start](../../../src/acp/infrastructure/acpAgentProcess.ts) spawns the configured command with workspace `cwd`.
It runs `initialize` and manages the stdio NDJSON connection.

Related: [authentication](../acp/authentication.md), [client](../acp/client.md), [agent-registry](../acp/agent-registry.md).
