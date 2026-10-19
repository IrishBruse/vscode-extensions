# VS Code Extensions Monorepo

Use Vite+ for install, lint, format, test, and pack.
The CLI is `vp`.
Package manager is npm workspaces.

Shared tooling lives at the repo root (`vite.config.ts`, `tsconfig.base.json`, common `devDependencies`).
Package `vite.config.ts` files keep only pack and test settings.
Do not re-add `vite-plus`, `typescript`, `@types/vscode`, or `@vscode/vsce` inside packages.

## Commands

- From the repo root, target a package with `vp -C <name> <command>`.
- Run scripts across packages with `npm run <script> --workspaces --if-present`.
- After a pull, run `vp install`.
- `vp check` formats, lints, and type-checks from the root config.

Docs: `node_modules/vite-plus/docs` and https://viteplus.dev/guide/.
Monorepo guide: https://viteplus.dev/guide/monorepo

## Placeholders

`ib-markdown-inline` and `ib-mermaid` are README-only placeholders.
They are not workspace packages yet.
Do not add `package.json` there until extraction.
Markdown Inline and Mermaid still ship from `ib-utilities`.

## Packages are deep modules

See each extension's `AGENTS.md` before changing it.
