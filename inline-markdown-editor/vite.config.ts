import { defineConfig } from "vite-plus";

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
    ],
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["src/test/setup.ts"],
        coverage: {
            provider: "v8",
            include: ["src/markdownInline/lib/**"],
            exclude: [
                "src/markdownInline/lib/decorations.ts",
                "src/markdownInline/lib/editor.ts",
                "src/markdownInline/lib/webview.ts",
                "src/markdownInline/lib/monaco/codeLens.ts",
                "src/markdownInline/lib/monaco/keybindings.ts",
                "src/markdownInline/lib/monaco/setup.ts",
                "src/markdownInline/lib/test/**",
                "src/markdownInline/lib/markdown/table/style.ts",
                "src/markdownInline/lib/markdown/image/style.ts",
                "src/markdownInline/lib/markdown/fence/mermaid/style.ts",
                "src/markdownInline/lib/markdown/shared/range.ts",
            ],
            reporter: ["text", "text-summary"],
            thresholds: {
                statements: 90,
                branches: 90,
                functions: 90,
                lines: 90,
            },
        },
        projects: [
            {
                test: {
                    name: "unit",
                    include: ["src/**/*.test.ts"],
                    exclude: [
                        "src/markdownInline/lib/**/integration.test.ts",
                        "src/markdownInline/lib/**/regression.test.ts",
                    ],
                },
            },
            {
                test: {
                    name: "markdownInline",
                    include: [
                        "src/markdownInline/lib/**/integration.test.ts",
                        "src/markdownInline/lib/**/regression.test.ts",
                    ],
                    fileParallelism: false,
                    testTimeout: 30_000,
                    hookTimeout: 30_000,
                },
            },
        ],
    },
});
