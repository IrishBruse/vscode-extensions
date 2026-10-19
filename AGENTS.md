# VS Code Extensions Monorepo

Package manager is npm workspaces.

Shared tooling lives at the repo root (`vite.config.ts`, `tsconfig.base.json`, common `devDependencies`).
Package `vite.config.ts` files keep only pack and test settings.
Do not re-add `vite-plus`, `typescript`, `@types/vscode`, or `@vscode/vsce` inside packages.

## Vite+

The CLI is `vp`.
Vite+ wraps runtime management, package management, and frontend tooling.
It is distinct from Vite.
`vp dev` and `vp build` run Vite.

Docs are in `node_modules/vite-plus/docs` and at https://viteplus.dev/guide/.
Monorepo guide: https://viteplus.dev/guide/monorepo

### Built-in commands vs scripts

`vp <name>` runs a built-in.
`vp run <name>` runs a `package.json` script or a `vite.config.ts` task.
Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things.
Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

From the repo root, target a package with `vp -C <name> <command>`.
Run scripts across packages with `npm run <script> --workspaces --if-present`.

### Shared package scripts

Every extension package uses these names:

| Script         | Role                                                       |
| -------------- | ---------------------------------------------------------- |
| `build`        | Dev build for that package                                 |
| `watch`        | Watch the extension host bundle (`vp pack --watch`)        |
| `package`      | Production pack (used by `vscode:prepublish`)              |
| `package:vsix` | Build a `.vsix` with vsce                                  |
| `install`      | Interactive local VSIX install via `dev/install-local.mjs` |
| `release`      | Interactive release via `dev/release.mjs`                  |
| `test`         | Package tests (`vp test run` …)                            |
| `verify`       | `build` + `test` + `vp check`                              |

Root owns `check`, `lint`, `format`, plus `npm run release` and `npm run install`.
Interactive prompts live in the `@ib/dev` package under `dev/`.
Do not redefine `check` / `lint` / `format` in packages.
Package-only scripts stay in that package's `package.json` and `AGENTS.md`.

### Tool versions

`vp toolchain` shows tool versions.
Add a tool name for one tool, for example `vp toolchain vite`.
`vp toolchain --global` ignores the local `vite-plus` package.
`vp why <package>` shows why that package is installed.

### Review checklist

- After a pull, run `vp install`.
- `vp check` formats, lints, and type-checks from the root config.
- Run package scripts with `vp -C <name> run <script>` or `vp run <script>` when defined.
- If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

## Changelog

Keep each package `CHANGELOG.md` `## Unreleased` section current with user-facing feature work.
Skip development-only changes (tooling, tests, refactors, agent/docs churn).
One short bullet per theme.
Use **Add** / **Fix** / **Remove** / **Change**.
Release moves Unreleased into the stamped version.

## Packages are deep modules

See each extension's `AGENTS.md` before changing it.
