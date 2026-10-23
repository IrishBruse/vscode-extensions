# Inline Markdown Editor

Edit Markdown in Visual Studio Code with formatted preview that stays out of your way until you need the source.

The file stays normal Markdown on disk.
When you click or select text, markers and raw syntax appear where you edit.
When you move away, the preview returns.

**Install:** search the Marketplace for **Inline Markdown Editor** ([publisher `irishbruse`](https://marketplace.visualstudio.com/publishers/irishbruse)), or install a `.vsix` from [this repository](https://github.com/IrishBruse/vscode-extensions).

**Requirements:** VS Code `^1.140.0`.

## Quick start

1. Install the extension.
2. Open a `.md` file.
3. Choose **Reopen Editor With... → Inline Markdown Editor**, or use the title-bar **Inline Markdown Editor** action.
4. Click text to edit source where you need it.
5. Use **Open Text Editor** in the title bar to switch back to the stock editor.

The custom editor is optional.
It is not the default for Markdown.
Git diffs and compare views keep the stock text editor.

## Features

### Inline preview

- Headings, emphasis, strikethrough, links, and blockquotes follow your color theme.
- You can set heading and inline-code colors under **Inline Markdown Editor** settings.
- Line numbers sit beside the text.
- Trailing spaces show as small gray marks so you can see them.

### Lists and tasks

- Nested bullets and numbered lists keep their structure in preview.
- Task lines show a checkbox.
- Click the checkbox to toggle the task without editing the marker by hand.

### Code fences

- Idle fences keep syntax highlighting and show a language label.
- Click a fence to edit the raw Markdown.
- Mermaid fences can show an inline diagram.
- If **IrishBruse's Utilities** is installed, **Open Preview** can open that extension’s Mermaid preview.

### Tables

- Tables render as a bordered grid.
- Click a cell to edit its Markdown.
- Use gap controls to add a row or column.
- Select a row or column from the cell border, then press Backspace or Delete to remove it.
- Wide cells wrap.
- Short columns stay narrow.
- Click a link in a table to open it.

### Images and HTML

- Images render in place when the path or URL resolves.
- Idle HTML blocks can show a sanitized preview.
- Click an HTML block to edit the raw source.

### Agent skills (`SKILL.md`)

- Files named `SKILL.md` treat YAML front matter as structured YAML.
- The body still uses the same Inline Markdown preview.

## Commands

- **Open Inline Markdown Editor** — open the active Markdown file in this editor.
- **Open Text Editor** — open the same file in the default text editor.

Both commands are also available from the editor title bar on `.md` files.

## Settings

Under **Inline Markdown Editor**:

- `markdownInlineEditor.colors.heading1` … `heading6` — preview colors for each heading level.
- `markdownInlineEditor.colors.inlineCode` — color for inline code text.
- `markdownInlineEditor.colors.inlineCodeBackground` — background for inline code.

## Tips

- Prefer this editor for reading and light edits.
- Use **Open Text Editor** when you want a full raw buffer, multi-cursor work, or a diff.
- Keep Mermaid preview in **IrishBruse's Utilities** if you want the dedicated diagram canvas.

## License

MIT.
See the repository for the full license text.
