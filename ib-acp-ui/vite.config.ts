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
            alwaysBundle: ["@agentclientprotocol/sdk"],
        },
        failOnWarn: false,
    },
    test: {
        clearMocks: false,
        environment: "node",
        include: ["src/**/*.test.ts", "webview/**/*.test.ts"],
    },
});
