# ib-markdown-inline

Inline Markdown custom editor extension.

Implementation lives under `src/markdownInline/`.
See [src/markdownInline/README.md](./src/markdownInline/README.md) before adding or importing a module.

From the monorepo root, prefer `vp -C ib-markdown-inline <command>`.

Use `agent-browser` for testing markdownInline at http://localhost:5175/

## Package-specific scripts

Shared scripts are documented in the root `AGENTS.md`.

- `test` runs the unit Vitest project (`vp test run --project unit`)
- `*-markdown-inline` scripts target `@ib-markdown-inline/markdown-inline` (playground, e2e, nested build)
