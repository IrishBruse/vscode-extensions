# VS Code Extensions

Monorepo for IrishBruse VS Code extensions.
Tooling is Vite+ (`vp`) with npm workspaces.

Shared at the repo root: `vite.config.ts` (lint/fmt/check), `tsconfig.base.json`, Vite+/TypeScript/`@types/vscode`/`vsce`, and `.vscode` launch/tasks.

## Extensions

| Package                  | Status                                         |
| ------------------------ | ---------------------------------------------- |
| `ib-utilities`           | Active                                         |
| `ib-acp-ui`              | Active                                         |
| `inline-markdown-editor` | Inline Markdown Editor                         |
| `ib-mermaid`             | Placeholder (future extract from ib-utilities) |

## Setup

```bash
vp install
```

## Shared scripts

Root: `check`, `lint`, `format`, `build`, `test`, `verify`, `package:vsix`, `install`, `release`.

Every package: `build`, `watch`, `package`, `package:vsix`, `install`, `release`, `test`, `verify`.

Interactive `release` / `install` live in `dev/` (`@ib/dev`) and can target any `ib-*` extension.
Use `npm run install` (not bare `npm install`) for the VSIX installer.

```bash
npm run build
npm run test
vp check
npm run release
npm run install
npm run install:all
npm run release -- --package ib-utilities patch
npm run install -- --package ib-acp-ui
```

## Package-only

See each package `AGENTS.md` for scripts such as markdown-inline playground (`inline-markdown-editor`) or playground/webview (`ib-acp-ui`).
