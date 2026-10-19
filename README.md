# VS Code Extensions

Monorepo for IrishBruse VS Code extensions.
Tooling is Vite+ (`vp`) with npm workspaces.

Shared at the repo root: `vite.config.ts` (lint/fmt/check), `tsconfig.base.json`, Vite+/TypeScript/`@types/vscode`/`vsce`, and `.vscode` launch/tasks.

## Extensions

| Package              | Status                                         |
| -------------------- | ---------------------------------------------- |
| `ib-utilities`       | Active                                         |
| `ib-acp-ui`          | Active                                         |
| `ib-markdown-inline` | Placeholder (future extract from ib-utilities) |
| `ib-mermaid`         | Placeholder (future extract from ib-utilities) |

## Setup

```bash
vp install
```

## Shared scripts

Root: `check`, `lint`, `format`, `build`, `test`, `verify`, `package:vsix`, `install:local`, `release`.

Every package: `build`, `watch`, `package`, `package:vsix`, `install:local`, `release`, `test`, `verify`.

Interactive `release` / `install:local` live in `dev/` (`@ib/dev`) and can target any `ib-*` extension.

```bash
npm run build
npm run test
vp check
npm run release
npm run install:local
npm run release -- --package ib-utilities patch
npm run install:local -- --package ib-acp-ui
```

## Package-only

See each package `AGENTS.md` for scripts such as markdown-inline helpers (`ib-utilities`) or playground/webview (`ib-acp-ui`).
