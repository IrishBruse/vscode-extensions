import { defineConfig } from "vite-plus";

export default defineConfig({
    staged: {
        "*": "vp check --fix",
    },
    fmt: {
        tabWidth: 4,
        singleQuote: false,
        semi: true,
        ignorePatterns: [
            "**/media/**",
            "**/dist/**",
            "ib-acp-ui/webview/**",
            "ib-acp-ui/playground/**",
            "ib-acp-ui/docs/acp/**",
            "ib-acp-ui/docs/cursor-extensions/**",
            "ib-markdown-inline/media/markdownInline/**",
        ],
    },
    lint: {
        ignorePatterns: ["**/media/**", "**/dist/**"],
        plugins: ["oxc", "typescript", "unicorn", "import", "node"],
        options: {
            typeAware: true,
            typeCheck: true,
        },
        env: {
            builtin: true,
        },
        jsPlugins: [
            {
                name: "vite-plus",
                specifier: "vite-plus/oxlint-plugin",
            },
        ],
        rules: {
            "vite-plus/prefer-vite-plus-imports": "error",
            "no-empty": ["error", { allowEmptyCatch: true }],
            "no-unused-vars": [
                "error",
                {
                    args: "all",
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    ignoreRestSiblings: true,
                },
            ],
        },
        overrides: [
            {
                files: ["ib-acp-ui/webview/**", "ib-acp-ui/playground/**"],
                plugins: ["react"],
            },
            {
                files: ["ib-utilities/**"],
                jsPlugins: [
                    {
                        name: "vscode",
                        specifier: "./ib-utilities/lint/vscodeExtension.js",
                    },
                ],
                rules: {
                    "vscode/contribution-sync": "error",
                    "vscode/no-dropped-disposable": "error",
                    "vscode/activation-events": "error",
                    "typescript/no-explicit-any": "error",
                    "typescript/no-deprecated": [
                        "error",
                        {
                            allow: [
                                { from: "lib", name: "caretRangeFromPoint" },
                                { from: "lib", name: "charCode" },
                                { from: "lib", name: "execCommand" },
                                { from: "lib", name: "keyCode" },
                                { from: "lib", name: "which" },
                            ],
                        },
                    ],
                    "typescript/no-misused-promises": "error",
                    "typescript/only-throw-error": "error",
                    "typescript/switch-exhaustiveness-check": [
                        "error",
                        { considerDefaultExhaustiveForUnions: true },
                    ],
                    "no-implied-eval": "error",
                },
            },
            {
                files: ["ib-markdown-inline/**"],
                jsPlugins: [
                    {
                        name: "vscode-markdown-inline",
                        specifier: "./ib-markdown-inline/lint/vscodeExtension.js",
                    },
                ],
                rules: {
                    "vscode-markdown-inline/contribution-sync": "error",
                    "vscode-markdown-inline/no-dropped-disposable": "error",
                    "vscode-markdown-inline/activation-events": "error",
                    "typescript/no-explicit-any": "error",
                    "typescript/no-deprecated": [
                        "error",
                        {
                            allow: [
                                { from: "lib", name: "caretRangeFromPoint" },
                                { from: "lib", name: "charCode" },
                                { from: "lib", name: "execCommand" },
                                { from: "lib", name: "keyCode" },
                                { from: "lib", name: "which" },
                            ],
                        },
                    ],
                    "typescript/no-misused-promises": "error",
                    "typescript/only-throw-error": "error",
                    "typescript/switch-exhaustiveness-check": [
                        "error",
                        { considerDefaultExhaustiveForUnions: true },
                    ],
                    "no-implied-eval": "error",
                },
            },
        ],
    },
});
