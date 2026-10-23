Packages are deep modules: see [../ib-markdown-inline/src/markdownInline/README.md](../ib-markdown-inline/src/markdownInline/README.md) before adding or importing one.

## Extraction

Inline Markdown ships from `ib-markdown-inline`.
Mermaid still ships from this extension.
Planned split: `ib-mermaid`.

Use `agent-browser` for testing markdownInline at http://localhost:5175/

## Package-specific scripts

From the monorepo root: `npm run <script> -w ib-utilities` or `vp -C ib-utilities run <script>`.

Shared scripts (`build`, `watch`, `package`, `package:vsix`, `install`, `release`, `test`, `verify`) are documented in the root `AGENTS.md`.

- `test` runs the unit project only (`vp test run --project unit`)
- `test:coverage` / `test:watch` are unit-project helpers
