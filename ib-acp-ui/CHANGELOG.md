# Changelog

Entries use **Add** / **Fix** / **Remove** / **Change** (bold label, colon, short sentence).
Update any bullet that does not follow this form.

## Unreleased

- **Add**: When the ACP agent stops or the connection is lost, the chat shows a disconnect banner with the error (including agent stderr) and the Setup sidebar lists the connection status.
- **Fix**: Successful bash tools no longer show a redundant `exit 0` line in the output preview.
- **Change**: Tool-call paths under the workspace folder show as workspace-relative paths.
- **Change**: The session file cache updates when a turn ends, not on every transcript update.
- **Change**: Whole-file reads stay on one line.
  Ranged reads can still expand to show the returned text.
- **Change**: The Thinking/Thought heading and preview use the default body font size.
- **Fix**: Streamed thought chunks no longer pick up an extra space between tokens.
- **Change**: The sidebar is a setup pane for ACP clients, runtime choices, and the open chat.
  It no longer lists previous chats.
- **Change**: The chat panel has no side margin, and its scrollbar matches the wider VS Code scrollbar.
- **Change**: The saved transcript screen lives in the `.acp` file under `cache`.
- **Add**: File edit previews show the line number for each row.
- **Change**: The editor tab keeps the braille spinner during tool calls, and switches the mark for a question, a plan, or a permission prompt.
- **Fix**: Thought timers stop when the turn errors or the agent disconnects.
- **Change**: A thought block shows up to the latest three lines, and opening it shows the full text.
- **Change**: A file tool line shows the path and keeps the end when the path is long.
  The path uses the link color, and hover uses the link hover color.

## 0.8.0

- **Fix**: The plan approval dialog renders the plan as markdown.
- **Change**: Thought blocks use quieter text, and the open body stays a three-line window on the newest lines.
- **Add**: A markdown file path in a tool result opens that file in the editor.
- **Change**: The composer shows the workspace path while the agent is working.
- **Add**: The editor tab title shows the Cursor agent monochrome status mark, and cycles it while the agent is generating.
- **Fix**: File names on tool-call lines use the link color.
- **Change**: A thought heading says Thinking while it is running and Thought once it finishes.
- **Change**: Attached image thumbnails use the input outline color for their border.
- **Add**: Thought blocks keep their elapsed time across reload and count up in tenths of a second while thinking.
- **Add**: Bash command tool calls use fish-style syntax colors on the command line.
- **Fix**: The **New Chat** `+ ▾` control shows on open `.acp` editor tabs.
- **Fix**: Thought blocks render markdown the same way as agent replies.
- **Fix**: Collapsed edit diffs preview around changed lines instead of always showing the file start.
- **Change**: Queued messages sit on one line above the composer with edit and remove actions.

## 0.7.0

- **Remove**: The tool call verbosity setting (`minimal`, `compact`, and `verbose`).
- **Change**: Tool calls use one line each.
  Click a line that has more text to show it.
  A write always shows its diff.
- **Change**: Subagent task calls show the short description, the subagent type, and the prompt.
  The raw argument JSON is no longer shown in the transcript.
- **Add**: User messages in the chat trace render as markdown, with the same headings, tables, and code blocks as agent replies.
- **Add**: Enter while the agent is running queues the message, then marks it as steering, then interrupts the current turn.
- **Add**: A sent message shows each attached image as a small thumbnail.
  Click the thumbnail to view it larger.
- **Change**: Transcript text uses the normal foreground color.
- **Change**: A run of thought blocks and tool calls has extra padding so the group stays separate from the reply.
- **Change**: A new thought block closes the previous one while the transcript follows the latest text.
  The previous block stays open when you have scrolled up and it is on screen.
- **Change**: Dropdowns use a VS Code-style list instead of the native menu, with the same corner radii as settings controls.

## 0.6.1

- **Add**: Recent chat rows in the empty-chat state show relative time since the last update on the right.

## 0.6.0

- **Add**: Install ACP agents from the official registry (**Browse Agent Registry**) with `npx`, `uvx`, and binary installs in extension storage; manual `ib-acp-ui.agents` still wins on name collision.
- **Add**: Composer agent picker switches agents before the first message.
- **Add**: Paste images from the clipboard into the chat composer; thumbnails render in the composer and ACP agents advertising image prompts receive them as image content blocks.
- **Add**: Empty new-chat page shows a **Provider** select and recent chats for that provider; new chats are titled `New <provider> chat` and the picker switches provider until the first message.
- **Add**: Click a pasted image thumbnail in the composer to view it fullscreen; click anywhere or press Escape to close.
- **Add**: Composer top bar shows context window usage like `12.3k/200k (6%)` from the agent's ACP usage updates.
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
