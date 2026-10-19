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
    run: {
        tasks: {
            "playground:fe": {
                command: "vp dev --config playground/vite.config.ts",
                cache: false,
            },
            "playground:be": {
                command: "tsx --watch playground/server.ts",
                cache: false,
            },
            "playground:be:demo": {
                command: "ACP_UI_DEMO=1 tsx --watch playground/server.ts",
                cache: false,
            },
            playground: {
                command: "true",
                dependsOn: ["playground:fe", "playground:be"],
                cache: false,
            },
            "playground:demo": {
                command: "true",
                dependsOn: ["playground:fe", "playground:be:demo"],
                cache: false,
            },
        },
    },
});
