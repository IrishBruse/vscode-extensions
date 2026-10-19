# VS Code Extensions

Monorepo for IrishBruse VS Code extensions.
Tooling is Vite+ (`vp`) with npm workspaces.

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

## Build

```bash
vp -C ib-utilities run build
vp -C ib-acp-ui run build
```

Or from the root:

```bash
npm run build
```

## Pack a VSIX

```bash
vp -C ib-utilities run package:vsix
vp -C ib-acp-ui run package
```

## Check

```bash
vp check
```
