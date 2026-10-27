import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite-plus";
import { readPlaygroundTheme } from "./vscodeUserTheme.ts";

const playgroundDir = dirname(fileURLToPath(import.meta.url));
const extensionRoot = join(playgroundDir, "..", "..", "..");
const monorepoRoot = join(extensionRoot, "..");
const docsMarkdownDir = join(extensionRoot, "docs", "tests", "markdown");
const require = createRequire(import.meta.url);
const monacoRoot = join(dirname(require.resolve("monaco-editor/editor/editor.api")), "../../..");
const monacoEditorMainCss = join(monacoRoot, "min/vs/editor/editor.main.css");

function vscodeUserThemePlugin(): Plugin {
    return {
        name: "vscode-user-theme",
        transformIndexHtml(html) {
            const theme = readPlaygroundTheme();
            const tags: HtmlTagDescriptor[] = [];
            if (theme.css.length > 0) {
                tags.push({
                    tag: "style",
                    attrs: { id: "vscode-user-settings-overrides" },
                    children: theme.css,
                    injectTo: "head",
                });
            }
            return {
                html: html.replace('class="vscode-dark"', `class="${theme.bodyClass}"`),
                tags,
            };
        },
    };
}

export default defineConfig({
    test: {
        // Vitest v4 compatibility: preserve mock call history.
        // Remove after tests no longer rely on calls from setup or earlier tests.
        // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
        // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
        clearMocks: false,
    },
    root: playgroundDir,
    define: {
        __DOCS_MARKDOWN_FS__: JSON.stringify(docsMarkdownDir),
        __INLINE_TESTS_FS__: JSON.stringify(join(playgroundDir, "..", "tests")),
        __INLINE_LIB_FS__: JSON.stringify(join(playgroundDir, "..", "lib")),
    },
    resolve: {
        alias: {
            "monaco-editor/min/vs/editor/editor.main.css": monacoEditorMainCss,
        },
    },
    server: {
        port: 5175,
        strictPort: true,
        fs: {
            allow: [monorepoRoot],
        },
    },
    plugins: [vscodeUserThemePlugin()],
});
