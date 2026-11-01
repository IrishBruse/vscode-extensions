# Changelog

Entries use **Add** / **Fix** / **Remove** / **Change** (bold label, colon, short sentence).
Update any bullet that does not follow this form.

## Unreleased

- **Add**: A GitHub alert quote shows that alert's color and an icon in place of the `[!…]` marker.
- **Fix**: Inline marks stay previewed until the caret is inside their source.
- **Add**: Markdown diffs open in the inline editor for the inline view and the side-by-side view.
- **Change**: README feature tour and `npm run screenshots` for marketplace images.

## 0.5.0

- **Add**: A normal markdown file paints leading YAML front matter like a skill document.

## 0.4.0

- **Fix**: A triple-click selects the full line.
- **Fix**: On macOS, Command+arrow matches the Linux Ctrl+arrow word and scroll keys.
- **Change**: Lazy-load Mermaid in the webview so the main editor script is smaller on open.

## 0.3.0

- **Fix**: Mermaid preview shows a line number in the gutter for every fence line.
- **Fix**: Mermaid preview fits the source fence height instead of growing past those lines.
- **Fix**: Open Markdown with the inline editor unless a real diff tab shows content changes.
- **Add**: Inline Markdown Editor extracted from `ib-utilities`.
- **Change**: Single extension package (editor deps and playground scripts live on `inline-markdown-editor` instead of a nested workspace).
- **Change**: Extension display name is Inline Markdown Editor.
- **Change**: Package id and command prefix are `inline-markdown-editor`.
- **Change**: Extension icon uses a Markdown M↓ mark.
- **Change**: Documented `markdownInlineEditor.colors.*` settings in the extension manifest.
