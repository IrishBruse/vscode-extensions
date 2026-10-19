# Rules

Unless explicity request there is no need to implement backwards compatability handling when modifying a feature.

The protocol name is **ACP** (Agent Client Protocol). Do not write **apc** in prose, comments, UI copy, or docs.
In code, the `AcpUi` / `acpUi` prefix is the conventional camelCase/PascalCase form of that name.

From the monorepo root, prefer `vp -C ib-acp-ui <command>`.

## Package-specific scripts

Shared scripts are documented in the root `AGENTS.md`.

- `build:webview` / `build:extension` / `watch:webview` — webview and host bundles
- `dev:playground` / `dev:playground:demo` — local playground
- `build:fixtures` / `screenshots` / `sync:playground-theme` — docs assets
- `publish:vscode` / `sync:docs` — marketplace and vendor docs
