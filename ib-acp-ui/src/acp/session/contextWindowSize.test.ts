import { describe, expect, it } from "vite-plus/test";
import {
    inferContextWindowSizeTokens,
    parseContextSizeLabel,
    promptTurnTokenCount,
} from "./contextWindowSize";
import type { AcpUiSessionConfigState } from "./sessionConfigOptions";

describe("parseContextSizeLabel", () => {
    it("parses k and m suffixes", () => {
        expect(parseContextSizeLabel("200k")).toBe(200_000);
        expect(parseContextSizeLabel("1m")).toBe(1_000_000);
        expect(parseContextSizeLabel("272K")).toBe(272_000);
    });
});

describe("inferContextWindowSizeTokens", () => {
    it("prefers an explicit context config option", () => {
        const config: AcpUiSessionConfigState = {
            options: [
                {
                    configId: "context_size",
                    name: "Context",
                    category: "model_config",
                    type: "select",
                    currentValue: "300k",
                    options: [
                        { value: "200k", name: "200K" },
                        { value: "300k", name: "300K" },
                    ],
                },
            ],
        };
        expect(
            inferContextWindowSizeTokens(
                { currentModelId: "composer-2.5", availableModels: [] },
                config,
            ),
        ).toBe(300_000);
    });

    it("reads context from bracket-encoded model ids", () => {
        expect(
            inferContextWindowSizeTokens(
                {
                    currentModelId: "claude-opus-4-6[thinking=true,context=1m]",
                    availableModels: [],
                },
                null,
            ),
        ).toBe(1_000_000);
    });

    it("defaults Composer to 200k when Cursor omits usage_update", () => {
        expect(
            inferContextWindowSizeTokens(
                { currentModelId: "composer-2.5", availableModels: [] },
                null,
            ),
        ).toBe(200_000);
    });
});

describe("promptTurnTokenCount", () => {
    it("prefers totalTokens", () => {
        expect(
            promptTurnTokenCount({
                totalTokens: 42_000,
                inputTokens: 30_000,
                outputTokens: 12_000,
            }),
        ).toBe(42_000);
    });

    it("falls back to input and output", () => {
        expect(
            promptTurnTokenCount({
                totalTokens: 0,
                inputTokens: 100,
                outputTokens: 50,
            }),
        ).toBe(150);
    });
});
