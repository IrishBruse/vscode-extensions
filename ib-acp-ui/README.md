# ACP UI

Chat with [Agent Client Protocol (ACP)](https://github.com/agentclientprotocol) agents from Visual Studio Code.

Open **ACP UI** from the activity bar for a chat surface next to your code.
The **Chats** view lists sessions.
The same UI can open in an editor tab or a side panel.

![ACP UI conversation panel](docs/Fullscreen.png)

_Streaming markdown, tool calls, thoughts, and plans in the ACP UI trace._

**Install:** search the Marketplace for **ACP UI** ([publisher `irishbruse`](https://marketplace.visualstudio.com/publishers/irishbruse)), or install a `.vsix` from [this repository](https://github.com/IrishBruse/vscode-extensions).

**Requirements:**

- VS Code `^1.140.0`
- For `npx` / `uvx` registry agents: Node (`npx`) or [uv](https://github.com/astral-sh/uv) on your `PATH`
- Auth or environment variables required by your chosen agent

Binary registry agents download into extension storage.
You do not need a global install for those agents.

## Quick start

1. Install the extension.
2. Open **ACP UI** from the activity bar.
3. Run **Browse Agent Registry** from the Chats title menu or the Command Palette.
4. Install an agent.
5. Start a chat with **Open ACP UI** or **New ACP UI in Editor**.

## Features

### Conversation UI

ACP-backed chat runs in an editor tab or panel.
Markdown follows your theme, with colored headings and highlighted fenced code.

![ACP UI markdown rendering](docs/Markdown.png)

### Tool calls and plans

Tool calls appear inline in the trace (reads, terminal runs, file diffs).

![ACP UI tool call with diff](docs/Tool-call.png)

Agent plans render as structured plan blocks.

![ACP UI plan block](docs/Plan.png)

### Chats sidebar

List sessions under the **ACP UI** activity bar.
Open, refresh, rename, or delete sessions from the view.

### Session config

When the agent advertises model and tuning options, the composer shows session config.

Cursor-style bracketed models show a family picker plus derived params (for example **Fast**):

![Cursor-style model picker](docs/Model-picker-cursor.png)

Agents that advertise explicit `model_config` options use a Zed-style toolbar (model, thinking, context, effort, and more):

![Agent-ordered model picker](docs/Model-picker-opus.png)

### Agent Registry

Browse and install agents from the official ACP catalog.
Optional manual overrides use `ib-acp-ui.agents`.

### Diagnostics

Open **Show ACP RPC Log** to inspect protocol traffic in the **ACP UI RPC** output channel.

## Install agents from the registry

Use **Browse Agent Registry** to install from the curated [ACP Registry](https://agentclientprotocol.com/get-started/registry).

Installs live in extension global storage, not in `settings.json`.

- **Refresh Agent Registry** — reload the catalog
- **Uninstall Registry Agent** — remove an install

Settings:

- `ib-acp-ui.registry.enabled` (default `true`)
- `ib-acp-ui.registry.url` (catalog URL)
- `ib-acp-ui.registry.cacheTtlHours` (default `24`)

## Manual agent override

Set `ib-acp-ui.agents` when you need a hand-written spawn config.
Manual entries override registry installs with the same display name.

```json
"ib-acp-ui.agents": [
  {
    "name": "My Agent",
    "command": "my-agent",
    "args": ["--acp"]
  }
]
```

Fields:

- `name` — label shown in ACP UI
- `command` — executable to spawn
- `args` — optional argument list
- `env` — optional per-agent environment variables
- `authMethodId` — optional when the agent advertises several auth methods

## Common actions

- **Browse Agent Registry** — install or manage catalog agents
- **Open ACP UI** — open or focus the chat panel
- **New ACP UI in Editor** — open chat in an editor tab
- **Focus ACP UI Chats list** — focus the session list
- **Show ACP RPC Log** — open the protocol output channel

The composer also supports slash commands that the active agent advertises.

## Troubleshooting

- No agents in the picker: run **Browse Agent Registry** and install one, or add a manual `ib-acp-ui.agents` entry.
- No responses in chat: confirm the agent command runs and supports ACP mode.
  Keep `npx` or `uvx` on `PATH` for package agents.
- Need diagnostics: open the **ACP UI RPC** output channel and retry the action.

## License

MIT
