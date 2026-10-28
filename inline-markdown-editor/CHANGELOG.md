# Changelog

Entries use **Add** / **Fix** / **Remove** / **Change** (bold label, colon, short sentence).
Update any bullet that does not follow this form.

## Unreleased

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
