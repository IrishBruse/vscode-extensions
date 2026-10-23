import { createRequire } from "node:module";
import { defineConfig } from "vite-plus";

const require = createRequire(import.meta.url);
const mermaidMinJs = require.resolve("mermaid/dist/mermaid.min.js");

export default defineConfig({
    pack: [
        {
            name: "extension",
            entry: { extension: "src/extension.ts" },
            format: "cjs",
            platform: "node",
            outDir: "dist",
            target: "node20",
            deps: { neverBundle: ["vscode"] },
            dts: false,
            fixedExtension: false,
            hash: false,
            sourcemap: true,
        },
        {
            name: "mermaid-theme",
            entry: { vsCodeTheme: "src/lib/mermaid/vsCodeTheme.browser.ts" },
            format: "iife",
            globalName: "IbMermaidVsCodeThemeBundle",
            platform: "browser",
            outDir: "media/mermaidPreview",
            target: "es2020",
            dts: false,
            hash: false,
            clean: false,
            sourcemap: true,
            outputOptions: (options, format) =>
                format === "iife"
                    ? { ...options, entryFileNames: "[name].js", chunkFileNames: "[name].js" }
                    : options,
            copy: [{ from: mermaidMinJs, to: "media/mermaidPreview" }],
        },
    ],
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["src/test/setup.ts"],
        projects: [
            {
                test: {
                    name: "unit",
                    include: ["src/**/*.test.ts", "lint/**/*.test.ts"],
                },
            },
        ],
    },
});
