# VS Code Extensions

Monorepo for IrishBruse VS Code extensions.
Tooling is Vite+ (`vp`) with npm workspaces.

Shared at the repo root: `vite.config.ts` (lint/fmt/check), `tsconfig.base.json`, Vite+/TypeScript/`@types/vscode`/`vsce`, and `.vscode` launch/tasks.

## Extensions

| Package | Status |
| --- | --- |
| `ib-utilities` | Active |
| `ib-acp-ui` | Active |
| `ib-markdown-inline` | Placeholder (future extract from ib-utilities) |
| `ib-mermaid` | Placeholder (future extract from ib-utilities) |

## Setup

```bash
vp install
```

## Shared scripts

Root: `check`, `lint`, `format`, `build`, `test`, `verify`, `package:vsix`, `install:local`.

Every package: `build`, `watch`, `package`, `package:vsix`, `install:local`, `test`, `verify`.

```bash
npm run build
npm run test
vp check
npm run package:vsix -w ib-utilities
npm run install:local -w ib-acp-ui
```

## Package-only

See each package `AGENTS.md` for scripts such as markdown-inline helpers (`ib-utilities`) or playground/webview (`ib-acp-ui`).
