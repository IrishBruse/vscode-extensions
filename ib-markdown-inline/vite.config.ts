import { defineConfig } from "vite-plus";

export default defineConfig({
    pack: {
        entry: ["src/extension.ts"],
        format: ["cjs"],
        platform: "node",
        outDir: "dist",
        fixedExtension: false,
        clean: true,
        deps: {
            neverBundle: ["vscode"],
        },
        failOnWarn: false,
    },
    test: {
        clearMocks: false,
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
});
