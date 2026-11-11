import { describe, expect, it } from "vite-plus/test";
import { normalizeVisibleTrace } from "../protocol/visibleTrace";
import {
    ACP_UI_SESSION_SCHEMA,
    applySavedModelConfig,
    enqueueSessionFileWrite,
    modelConfigFromSessionOptions,
    normalizeSessionModelConfig,
    normalizeUserMessageHistory,
    parseSessionDocument,
    parseSessionFile,
    parseSessionHeaderBlock,
    parseSessionHeaderLine,
    serializeSessionDocument,
    sessionFileNameForId,
    shouldDeferJsonlHistoryReplay,
} from "./acpUiSessionJsonlFormat";

describe("enqueueSessionFileWrite", () => {
    it("runs operations for the same file in order", async () => {
        const key = "/tmp/test-session.acp";
        const order: number[] = [];
        let releaseFirst: (() => void) | undefined;
        const firstGate = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });
        const first = enqueueSessionFileWrite(key, async () => {
            order.push(1);
            await firstGate;
            order.push(2);
        });
        const second = enqueueSessionFileWrite(key, async () => {
            order.push(3);
        });
        await new Promise<void>((resolve) => {
            queueMicrotask(() => resolve());
        });
        expect(order).toEqual([1]);
        releaseFirst?.();
        await Promise.all([first, second]);
        expect(order).toEqual([1, 2, 3]);
    });
});

describe("sessionFileNameForId", () => {
    it("names the chat file from the session id", () => {
        expect(sessionFileNameForId("6f1c2a40-1b2e-4c3d-9a8b-0e1f2a3b4c5d")).toBe(
            "6f1c2a40-1b2e-4c3d-9a8b-0e1f2a3b4c5d.acp",
        );
    });
});

describe("normalizeUserMessageHistory", () => {
    it("keeps non-empty strings and caps at 55 entries", () => {
        const entries = Array.from({ length: 60 }, (_, i) => `msg-${i}`);
        expect(normalizeUserMessageHistory(entries)).toHaveLength(55);
        expect(normalizeUserMessageHistory(["", "hello", 1, null])).toEqual(["hello"]);
    });

    it("extracts submit bodies from legacy replay events", () => {
        expect(
            normalizeUserMessageHistory([
                { type: "submit", body: "hello" },
                { type: "appendAgentText", text: "ignored" },
            ]),
        ).toEqual(["hello"]);
    });
});

describe("serializeSessionDocument", () => {
    it("stores the viewport trace on the session document under cache", () => {
        const document = {
            schema: ACP_UI_SESSION_SCHEMA,
            id: "id-1",
            title: "Chat",
            createdAt: 1,
            updatedAt: 2,
            history: ["hello"],
            cache: [
                { type: "user" as const, text: "hi" },
                { type: "thought" as const, text: "Planning.", durationMs: 800 },
            ],
        };
        const text = serializeSessionDocument(document);
        expect(parseSessionDocument(text)).toEqual(document);
    });

    it("does not keep a jsonl visible-trace version in cache", () => {
        const text = JSON.stringify({
            schema: ACP_UI_SESSION_SCHEMA,
            id: "id-1",
            title: "Chat",
            createdAt: 1,
            updatedAt: 2,
            history: [],
            cache: [
                {
                    type: "meta",
                    schema: "acpUi/visibleTrace/1",
                    sessionId: "id-1",
                    sessionFile: "Chat.acp",
                },
                { type: "user", text: "hi" },
            ],
        });
        expect(parseSessionDocument(text)?.cache).toEqual([{ type: "user", text: "hi" }]);
    });

    it("does not parse a jsonl string stored under cache", () => {
        const text = JSON.stringify({
            schema: ACP_UI_SESSION_SCHEMA,
            id: "id-1",
            title: "Chat",
            createdAt: 1,
            updatedAt: 2,
            history: [],
            cache: '{"type":"user","text":"hi"}\n',
        });
        expect(parseSessionDocument(text)?.cache).toBeUndefined();
    });

    it("round-trips the last model configuration", () => {
        const document = {
            schema: ACP_UI_SESSION_SCHEMA,
            id: "id-1",
            title: "Chat",
            createdAt: 1,
            updatedAt: 2,
            history: [],
            modelConfig: {
                modelId: "grok-4[effort=high,fast=false]",
                options: [
                    { configId: "model", value: "grok-4[effort=high,fast=false]" },
                    { configId: "mode", value: "agent" },
                ],
            },
        };
        expect(parseSessionDocument(serializeSessionDocument(document))?.modelConfig).toEqual(
            document.modelConfig,
        );
    });

    it("round-trips remembered permission grants", () => {
        const document = {
            schema: ACP_UI_SESSION_SCHEMA,
            id: "id-1",
            title: "Chat",
            createdAt: 1,
            updatedAt: 2,
            history: [],
            permissionGrants: [{ scopeKey: "kind:execute", decision: "allow" as const }],
        };
        expect(parseSessionDocument(serializeSessionDocument(document))?.permissionGrants).toEqual(
            document.permissionGrants,
        );
    });

    it("drops derived composer controls from a saved model configuration", () => {
        expect(
            normalizeSessionModelConfig({
                modelId: "grok-4",
                options: [
                    { configId: "_derived:effort", value: "high" },
                    { configId: "mode", value: "agent" },
                    { configId: "fast", value: false },
                ],
            }),
        ).toEqual({
            modelId: "grok-4",
            options: [
                { configId: "mode", value: "agent" },
                { configId: "fast", value: false },
            ],
        });
        expect(
            modelConfigFromSessionOptions([
                {
                    configId: "model",
                    type: "select",
                    category: "model",
                    currentValue: "grok-4[effort=medium]",
                    options: [{ value: "grok-4[effort=medium]" }],
                },
                {
                    configId: "_derived:effort",
                    type: "select",
                    currentValue: "medium",
                    options: [{ value: "medium" }],
                },
                {
                    configId: "mode",
                    type: "select",
                    currentValue: "plan",
                    options: [{ value: "plan" }],
                },
            ]),
        ).toEqual({
            modelId: "grok-4[effort=medium]",
            options: [
                { configId: "model", value: "grok-4[effort=medium]" },
                { configId: "mode", value: "plan" },
            ],
        });
    });

    it("restores saved model and option values onto advertised options", () => {
        const restored = applySavedModelConfig(
            [
                {
                    configId: "model",
                    type: "select" as const,
                    category: "model",
                    currentValue: "grok-4[effort=low]",
                    options: [{ value: "grok-4[effort=low]" }, { value: "grok-4[effort=high]" }],
                },
                {
                    configId: "mode",
                    type: "select" as const,
                    currentValue: "agent",
                    options: [{ value: "agent" }, { value: "plan" }],
                },
            ],
            {
                modelId: "grok-4[effort=high]",
                options: [
                    { configId: "model", value: "grok-4[effort=low]" },
                    { configId: "mode", value: "plan" },
                ],
            },
        );
        expect(restored.map((option) => option.currentValue)).toEqual([
            "grok-4[effort=high]",
            "plan",
        ]);
    });

    it("round-trips a session document with user message history", () => {
        const document = {
            schema: ACP_UI_SESSION_SCHEMA,
            id: "id-1",
            title: "Chat",
            createdAt: 1,
            updatedAt: 2,
            history: ["hello", "world"],
        };
        const text = serializeSessionDocument(document);
        expect(parseSessionDocument(text)).toEqual(document);
        expect(parseSessionFile(text).header).toEqual(document);
    });
});

describe("parseSessionHeaderBlock", () => {
    it("spans all lines of a session document", () => {
        const document = {
            schema: ACP_UI_SESSION_SCHEMA,
            id: "id-1",
            title: "Chat",
            createdAt: 1,
            updatedAt: 2,
            history: ["hi"],
        };
        const text = serializeSessionDocument(document).trimEnd();
        const parsed = parseSessionHeaderBlock(text);
        expect(parsed?.header).toEqual(document);
        expect(parsed?.consumedLines).toBe(text.split("\n").length);
    });
});

describe("parseSessionHeaderLine", () => {
    it("parses a valid legacy single-line header with promptHistory", () => {
        const header = {
            schema: ACP_UI_SESSION_SCHEMA,
            id: "abc",
            title: "Chat 1",
            agentName: "Cursor",
            runtimeSessionId: "runtime-1",
            promptHistory: ["hello"],
            createdAt: 100,
            updatedAt: 200,
        };
        const parsed = parseSessionHeaderLine(JSON.stringify(header));
        expect(parsed).toEqual({
            schema: ACP_UI_SESSION_SCHEMA,
            id: "abc",
            title: "Chat 1",
            agentName: "Cursor",
            runtimeSessionId: "runtime-1",
            createdAt: 100,
            updatedAt: 200,
            history: ["hello"],
        });
    });

    it("returns null for malformed header", () => {
        expect(parseSessionHeaderLine("{}")).toBeNull();
        expect(parseSessionHeaderLine("")).toBeNull();
        expect(parseSessionHeaderLine("not json")).toBeNull();
    });
});

describe("session cache items", () => {
    it("keeps trace items and drops invalid entries", () => {
        const items = [
            { type: "user" as const, text: "hi" },
            {
                type: "thought" as const,
                text: "The user sent a simple greeting.",
                durationMs: 1200,
            },
            { type: "agent" as const, text: "Hi – what do you want to work on?" },
            { type: "meta", schema: "acpUi/visibleTrace/1" },
            "not an item",
        ];
        expect(normalizeVisibleTrace(items)).toEqual(items.slice(0, 3));
    });

    it("round-trips an in-progress thought start time", () => {
        const items = [
            { type: "thought" as const, text: "Still thinking.", startedAtMs: 1_700_000_000_000 },
        ];
        expect(normalizeVisibleTrace(items)).toEqual(items);
    });

    it("drops non-positive thought durations", () => {
        expect(
            normalizeVisibleTrace([
                { type: "thought", text: "A", durationMs: 0 },
                { type: "thought", text: "B", durationMs: -3 },
                { type: "thought", text: "C", durationMs: 40 },
            ]),
        ).toEqual([
            { type: "thought", text: "A" },
            { type: "thought", text: "B" },
            { type: "thought", text: "C", durationMs: 40 },
        ]);
    });

    it("round-trips tool command durations and drops non-positive values", () => {
        const items = [
            {
                type: "tool" as const,
                toolCallId: "exec1",
                title: "Terminal",
                kind: "execute",
                status: "completed" as const,
                subtitle: "ls -la tests",
                durationMs: 117,
            },
        ];
        expect(normalizeVisibleTrace(items)).toEqual(items);
        expect(
            normalizeVisibleTrace([
                {
                    type: "tool",
                    toolCallId: "exec2",
                    title: "Terminal",
                    kind: "execute",
                    status: "completed",
                    durationMs: 0,
                },
            ]),
        ).toEqual([
            {
                type: "tool",
                toolCallId: "exec2",
                title: "Terminal",
                kind: "execute",
                status: "completed",
            },
        ]);
    });

    it("keeps the last 40 items", () => {
        const items = Array.from({ length: 45 }, (_, index) => ({
            type: "user" as const,
            text: `m-${index}`,
        }));
        const parsed = normalizeVisibleTrace(items);
        expect(parsed).toHaveLength(40);
        expect(parsed[0]).toEqual({ type: "user", text: "m-5" });
        expect(parsed[39]).toEqual({ type: "user", text: "m-44" });
    });
});

describe("shouldDeferJsonlHistoryReplay", () => {
    it("defers when a runtime session id is stored", () => {
        expect(shouldDeferJsonlHistoryReplay({ runtimeSessionId: "runtime-1" })).toBe(true);
        expect(
            shouldDeferJsonlHistoryReplay({
                runtimeSessionId: "  runtime-1  ",
            }),
        ).toBe(true);
    });

    it("does not defer without a runtime session id", () => {
        expect(shouldDeferJsonlHistoryReplay({})).toBe(false);
        expect(shouldDeferJsonlHistoryReplay({ runtimeSessionId: "" })).toBe(false);
        expect(shouldDeferJsonlHistoryReplay({ runtimeSessionId: "   " })).toBe(false);
    });
});
