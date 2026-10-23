# IrishBruse's Utilities

A Visual Studio Code extension with snippet tools, GitHub helpers, Mermaid preview, and small editor utilities.

**Install:** search the Marketplace for **IrishBruse's Utilities** ([publisher `irishbruse`](https://marketplace.visualstudio.com/publishers/irishbruse)), or install a `.vsix` from [this repository](https://github.com/IrishBruse/vscode-extensions).

**Requirements:** VS Code `^1.140.0`.
The [GitHub CLI](https://cli.github.com/) (`gh`) must be on your `PATH` for pull-request features (or set `ib-utilities.github.ghPath`).

## Quick start

1. Install the extension.
2. Open a git repository for **Git Helpers** in the Source Control sidebar.
3. Open the **Snippet Manager** activity bar to manage snippets.
4. Open the **Localhost** view to browse local websites.

## Features

### Snippet Manager

Use the **Snippet Manager** activity bar to create, edit, and delete snippets in folders.

- Map snippet file labels to [language IDs](https://code.visualstudio.com/docs/languages/overview) for highlighting.
- Auto-generate snippets from several language sources with the settings below.

### Git Helpers

The **Git Helpers** panel in Source Control shows actions for the **active repository**.
The panel caches data per repository, so switching repos restores the last known state.

- **Pull request** — opens the GitHub PR for the current branch.
  Draft PRs use a draft icon.
  Inline actions copy the PR URL and mark a draft PR ready.
- **Diff** — opens a multi-file diff against the base branch.
  The row shows the base branch and change counts.
  Use **Set Base Branch** to change the base.
- **Create draft PR** — appears when there is no open PR and the branch is not the base branch.

The title bar opens the GitHub repository and refreshes the panel.

### Localhost

The **Localhost** panel lists local websites that are listening.

- Click a row to open it in the browser.
- Refresh from the title bar.
- Stop the process on that port with the inline action.

### Explorer and Source Control actions

- Right-click a file in the explorer for **Copy GitHub Head URL** (blob link at the current branch `HEAD`).
- Under **Source Control → Changes**, right-click for **Copy Path**, **Copy Relative Path**, and **Copy GitHub Head URL**.

### Relative goto

**Relative goto** jumps by line in the active editor.

- Type a number to move forward by that many lines.
- Prefix with `-` to move backward.
- Prefix with a space for an absolute line number.

### Mermaid Preview

Open `.mmd` or `.mermaid` files as source text by default (including diffs).

- Use **Open Preview** in the title bar for a live diagram that follows your color theme.
- Zoom, pan, fit, or copy the diagram as PNG from the preview toolbar.
- Use **Open Source** to return to the text editor.

In Markdown files, Mermaid fences get syntax highlighting.

- Use the **Open Preview** CodeLens above a fence, or Ctrl/Cmd+click the `mermaid` language tag.
- Edits in the Markdown fence stay in sync while the preview is open.

Clickable nodes (flowchart `click` links, Gantt task links, and similar) can open a file in the editor.

Supported location formats:

- `path:line:column` (preferred)
- `path#Lline,column` (VS Code fragment)
- `path#Lline` (line only; column defaults to 1)

`http(s)` and `mailto:` links open in the browser.
Hold **Ctrl** or **Cmd** while clicking to open beside the active tab.

### Theme

**Empty Dark Theme** is an optional dark UI theme under **Preferences: Color Theme**.

### Discard editor changes

**Discard Editor Changes** reloads the file from disk when the buffer conflicts with the file on disk.

## Settings

```json
{
    "ib-utilities.languageIdMappings": {
        "node": "typescript",
        "react": "typescriptreact"
    },
    "ib-utilities.generatedLanguageMappings": {
        "typescriptreact": "node,react"
    },
    "ib-utilities.github.ghPath": "",
    "ib-utilities.gitHelpers.debugMode": false
}
```

- `languageIdMappings` — map snippet file labels to VS Code language IDs.
- `generatedLanguageMappings` — target language ID on the left; comma-separated source labels on the right.
- `github.ghPath` — absolute path to `gh` when it is not on `PATH`.
- `gitHelpers.debugMode` — show mock Git Helpers data for UI checks.

## Related extensions

For Markdown editing with formatted preview, install **Inline Markdown Editor** from this repository (`inline-markdown-editor`).

## License

[MIT](LICENSE.md)
