# Changelog

Entries use **Add** / **Fix** / **Remove** / **Change** (bold label, colon, short sentence).
Update any bullet that does not follow this form.

## Unreleased

## 0.6.0

- **Add**: Install ACP agents from the official registry (**Browse Agent Registry**) with `npx`, `uvx`, and binary installs in extension storage; manual `ib-acp-ui.agents` still wins on name collision.
- **Add**: Composer agent picker switches agents before the first message.
- **Add**: Paste images from the clipboard into the chat composer; thumbnails render in the composer and ACP agents advertising image prompts receive them as image content blocks.
- **Add**: Empty new-chat page shows a **Provider** select and recent chats for that provider; new chats are titled `New <provider> chat` and the picker switches provider until the first message.
- **Add**: Click a pasted image thumbnail in the composer to view it fullscreen; click anywhere or press Escape to close.
- **Change**: Chat UI under 800px wide collapses side padding to 4px and uses the full panel width for transcript and composer.
- **Change**: Chat UI follows the current VS Code design language (corner radius, spacing, fonts, and focus states).
- **Fix**: Playground honors `ib-acp-ui.contentWidthPercent` (or `ACP_UI_CONTENT_WIDTH_PERCENT`) so the content column matches the extension.

## 0.5.0 - 2026-07-07

- **Add**: `minimal` tool call verbosity groups tool calls with a summary and shows the last three detail lines.
- **Change**: `compact` tool calls show one line each with no group summary; `verbose` is unchanged.
- **Add**: Copy button on markdown code blocks (hover to reveal, brief copied feedback).
- **Change**: Chats live under `chats/<sessionId>/` with title-based `.acp` files so renames do not collide.
- **Change**: Session `.acp` files are a single JSON document with a `history` array; RPC traffic goes to the `ACP UI RPC` output channel.
- **Add**: `clientInfo` on ACP initialize so agents receive package metadata; protocol version mismatches surface actionable errors.
- **Add**: Chats sidebar lists agent sessions when supported, falls back to local files, and stays visible while refreshing.
- **Add**: `session/delete` through the SDK with local tombstones when remote delete is unavailable.
- **Add**: `npm run install:local` builds and installs the extension into local VS Code.
- **Fix**: Markdown table headers use the VS Code theme foreground color.
- **Fix**: Chats delete keeps removed sessions gone after refresh.
- **Fix**: Mid-prompt reconnect when sending a message after an agent-driven title update.
- **Fix**: ACP session lifecycle bugs in delete, connect, and UI config sync.

## 0.4.0 - 2026-07-06

- **Add**: `ib-acp-ui.toolCallVerbosity` setting (`verbose` or `compact`) for full blocks vs single-line tool call summaries.
- **Add**: `ib-acp-ui.contentWidthPercent` setting (10 to 100) for transcript and composer width.
- **Add**: Slash-command autocomplete grouped by skill source with user and global labels.
- **Change**: Markdown tables match VS Code settings lists (borderless, monospace, plain cell text).
- **Change**: Compact mode keeps terminal commands separate from read/grep groups and truncates long command output with a tail preview.
- **Change**: Conversation scrollbar pins to the far right of the chat panel while content stays centered.
- **Add**: Loading indicator shows immediately when a prompt is sent.

## 0.3.0 - 2026-07-06

- **Add**: Disk-backed `.acp` session files with JSONL event persistence, autosave, and a custom editor.
- **Add**: Resume chats on reopen via ACP `session/load`, with JSONL transcript replay as a fallback.
- **Add**: Chats sidebar driven by ACP `session/list` for the active agent, with loading state during resume.
- **Add**: Composer session config, model picker, model variant selection, and cached options on reconnect.
- **Add**: Session mode indicator with `Shift+Tab` mode cycling.
- **Add**: Agent `authenticate` / `logout` flows when auth methods are advertised.
- **Add**: New-chat shortcut, improved composer autocomplete, and markdown colors from the editor theme.

## 0.2.1 - 2026-04-14

- **Change**: Maintenance patch release with no user-facing feature changes.

## 0.2.0 - 2026-04-14

- **Add**: Built-in composer commands `/rename` and `/show-thinking`.
- **Add**: Keyboard and session rename in Chats (`F2`, command, and context menu).
- **Add**: Built-in command documentation in `BUILTIN_COMMANDS.md`, linked from `README.md`.
- **Change**: VS Code output channel renamed to `ACP UI RPC`.
- **Remove**: File-based RPC logging from extension activation.
