import { describe, expect, it } from "vite-plus/test";
import { normalizeVisibleTrace } from "../../protocol/visibleTrace";
import {
    cursorTodosFromExtensionParams,
    cursorTodosFromRaw,
    isCursorUpdateTodosRaw,
    isCursorUpdateTodosTitle,
    mergeCursorTodos,
} from "./cursorTodoPresentation";

describe("cursorTodoPresentation", () => {
    it("reads a cursor/update_todos payload", () => {
        expect(
            cursorTodosFromExtensionParams({
                toolCallId: "call-1",
                merge: true,
                todos: [
                    { id: "a", content: "Write the list", status: "in_progress" },
                    { id: "b", content: "Ship it", status: "pending" },
                ],
            }),
        ).toEqual({
            toolCallId: "call-1",
            merge: true,
            todos: [
                { id: "a", content: "Write the list", status: "in_progress" },
                { id: "b", content: "Ship it", status: "pending" },
            ],
        });
    });

    it("reads todos from an updateTodos tool payload", () => {
        expect(isCursorUpdateTodosRaw({ _toolName: "updateTodos" })).toBe(true);
        expect(isCursorUpdateTodosRaw('{"_toolName":"updateTodos"}')).toBe(true);
        expect(isCursorUpdateTodosTitle("Update TODOs")).toBe(true);
        expect(
            cursorTodosFromRaw({
                _toolName: "updateTodos",
                merge: true,
                todos: [{ id: "a", content: "Write the list", status: "completed" }],
            }),
        ).toEqual({
            merge: true,
            todos: [{ id: "a", content: "Write the list", status: "completed" }],
        });
    });

    it("merges by id and keeps the earlier order", () => {
        expect(
            mergeCursorTodos(
                [
                    { id: "a", content: "Write the list", status: "pending" },
                    { id: "b", content: "Ship it", status: "pending" },
                ],
                [{ id: "a", content: "Write the list", status: "completed" }],
                true,
            ),
        ).toEqual([
            { id: "a", content: "Write the list", status: "completed" },
            { id: "b", content: "Ship it", status: "pending" },
        ]);
    });

    it("keeps cursor todo ids on the saved trace", () => {
        const items = normalizeVisibleTrace([
            {
                type: "plan",
                cursorTodos: true,
                entries: [{ id: "a", content: "Write the list", status: "pending" }],
            },
        ]);
        expect(items).toEqual([
            {
                type: "plan",
                cursorTodos: true,
                entries: [{ id: "a", content: "Write the list", status: "pending" }],
            },
        ]);
    });
});
