import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(dir, "../../media/markdownInline");
const workerEntry = require.resolve("monaco-editor/editor/editor.worker.js");

export default defineConfig({
    root: dir,
    publicDir: false,
    build: {
        outDir,
        emptyOutDir: false,
        target: "es2024",
        minify: true,
        lib: {
            entry: workerEntry,
            formats: ["iife"],
            name: "MonacoEditorWorker",
            fileName: () => "editor.worker.js",
        },
        rollupOptions: {
            output: {
                codeSplitting: false,
            },
        },
    },
});
