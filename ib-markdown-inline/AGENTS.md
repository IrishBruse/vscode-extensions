# ib-markdown-inline

Inline Markdown custom editor extension.

Implementation lives under `src/markdownInline/`.
See [src/markdownInline/README.md](./src/markdownInline/README.md) before adding or importing a module.

`src/extension.ts` only activates the host and command wiring.
Business logic stays in `src/markdownInline/` (`lib/` has no `vscode` imports; `host/` may).

From the monorepo root, prefer `vp -C ib-markdown-inline <command>`.

Use `agent-browser` for testing markdownInline at http://localhost:5175/

## Mermaid theme helpers

`src/lib/mermaid/` holds local copies of mermaid diagram helpers and VS Code theme wiring for in-editor fences until a shared package exists.
Do not extract a new shared package in routine work.

## Optional ib-utilities integration

When both extensions are installed, the host may execute `ib-utilities.openMermaidMarkdownPreview` (see `src/constants.ts`) to open the Mermaid custom editor.
That command remains owned by `ib-utilities`.

## Package-specific scripts

Shared scripts are documented in the root `AGENTS.md`.

- `test` runs the unit Vitest project (`vp test run --project unit`)
- `dev:markdown-inline` / `e2e:markdown-inline` run the browser playground and its smoke script
- `test:markdown-inline-browser` runs integration and regression Vitest projects
- `check:markdown-inline` type-checks `src/markdownInline` and runs browser tests
- `fetch-markdown-large-fixtures` refreshes gitignored large fixtures under `docs/tests/markdown/large/`
