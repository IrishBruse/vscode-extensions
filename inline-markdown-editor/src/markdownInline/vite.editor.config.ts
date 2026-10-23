import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(dir, "../../media/markdownInline");
const monacoRoot = path.join(path.dirname(require.resolve("monaco-editor")), "../..");
const monacoEditorMainCss = path.join(monacoRoot, "min/vs/editor/editor.main.css");

export default defineConfig({
    root: dir,
    base: "./",
    publicDir: false,
    resolve: {
        alias: {
            "monaco-editor/min/vs/editor/editor.main.css": monacoEditorMainCss,
        },
    },
    build: {
        outDir,
        emptyOutDir: true,
        cssCodeSplit: false,
        modulePreload: false,
        target: "es2024",
        minify: true,
        chunkSizeWarningLimit: 10_000,
        rollupOptions: {
            input: path.join(dir, "lib/webview.ts"),
            output: {
                format: "es",
                entryFileNames: "editor.js",
                assetFileNames: "editor[extname]",
                codeSplitting: false,
            },
        },
    },
});
