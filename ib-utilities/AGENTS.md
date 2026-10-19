Packages are deep modules: see [src/markdownInline/README.md](./src/markdownInline/README.md) before adding or importing one.

## Extraction

Markdown Inline and Mermaid still ship from this extension.
Planned splits: `ib-markdown-inline`, `ib-mermaid`.
Those sibling folders are README-only placeholders.
Do not cross-import them yet.

Use `agent-browser` for testing markdownInline at http://localhost:5175/

Update `CHANGELOG.md` with changes skip development only changes.

## Package-specific scripts

From the monorepo root: `npm run <script> -w ib-utilities` or `vp -C ib-utilities run <script>`.

Shared scripts (`build`, `watch`, `package`, `package:vsix`, `install:local`, `release`, `test`, `verify`) are documented in the root `AGENTS.md`.

- `test` runs the unit project only (`vp test run --project unit`)
- `test:coverage` / `test:watch` are unit-project helpers
- `*-markdown-inline` scripts target `@ib-utilities/markdown-inline` and the browser Vitest project
- `fetch-markdown-large-fixtures` refreshes large markdown fixtures
