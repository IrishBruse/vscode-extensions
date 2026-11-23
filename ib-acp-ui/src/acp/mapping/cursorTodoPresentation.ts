import type { TodoEntry } from "../../protocol/extensionHostMessages";

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function recordFromRaw(raw: unknown): Record<string, unknown> | undefined {
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!trimmed.startsWith("{")) {
            return undefined;
        }
        try {
            const parsed: unknown = JSON.parse(trimmed);
            return recordFromRaw(parsed);
        } catch {
            return undefined;
        }
    }
    return isRecord(raw) ? raw : undefined;
}

/** Cursor status strings, including the spaced forms an agent plan also accepts. */
export function cursorTodoStatus(value: unknown): TodoEntry["status"] | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
    if (normalized === "pending") {
        return "pending";
    }
    if (normalized === "in_progress" || normalized === "inprogress") {
        return "in_progress";
    }
    if (normalized === "completed" || normalized === "complete" || normalized === "done") {
        return "completed";
    }
    if (normalized === "cancelled" || normalized === "canceled") {
        return "cancelled";
    }
    return undefined;
}

function parseTodo(value: unknown): TodoEntry | undefined {
    if (!isRecord(value)) {
        return undefined;
    }
    const { id, content, status } = value;
    if (typeof id !== "string" || id.trim().length === 0) {
        return undefined;
    }
    if (typeof content !== "string" || content.trim().length === 0) {
        return undefined;
    }
    return {
        id: id.trim(),
        content: content.trim(),
        status: cursorTodoStatus(status) ?? "pending",
    };
}

function parseTodoList(value: unknown): TodoEntry[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const todos: TodoEntry[] = [];
    for (const item of value) {
        const todo = parseTodo(item);
        if (todo !== undefined) {
            todos.push(todo);
        }
    }
    return todos;
}

/** True when this tool payload is Cursor's update-todos call. */
export function isCursorUpdateTodosRaw(raw: unknown): boolean {
    return recordFromRaw(raw)?._toolName === "updateTodos";
}

/** Title Cursor puts on an update-todos tool row. */
export function isCursorUpdateTodosTitle(title: string | undefined): boolean {
    const trimmed = title?.trim() ?? "";
    return trimmed === "Update TODOs" || trimmed.startsWith("Update TODOs:");
}

/**
 * Todos embedded in a tool `rawInput` (`{ _toolName: "updateTodos", todos, merge }`).
 * Missing when the payload is not that tool.
 */
export function cursorTodosFromRaw(
    raw: unknown,
): { todos: TodoEntry[]; merge: boolean } | undefined {
    const record = recordFromRaw(raw);
    if (record?._toolName !== "updateTodos") {
        return undefined;
    }
    return {
        todos: parseTodoList(record.todos),
        merge: record.merge === true,
    };
}

/** Todos from a `cursor/update_todos` extension request or notification. */
export function cursorTodosFromExtensionParams(params: Record<string, unknown>):
    | {
          toolCallId: string;
          todos: TodoEntry[];
          merge: boolean;
      }
    | undefined {
    const todos = parseTodoList(params.todos);
    if (todos.length === 0) {
        return undefined;
    }
    const toolCallId =
        typeof params.toolCallId === "string" && params.toolCallId.trim().length > 0
            ? params.toolCallId.trim()
            : "cursor-update-todos";
    return {
        toolCallId,
        todos,
        merge: params.merge === true,
    };
}

/** Applies one Cursor todo update onto the list already on screen. */
export function mergeCursorTodos(
    previous: readonly TodoEntry[],
    incoming: readonly TodoEntry[],
    merge: boolean,
): TodoEntry[] {
    if (!merge) {
        return [...incoming];
    }
    const incomingById = new Map(incoming.map((todo) => [todo.id, todo]));
    const seen = new Set<string>();
    const next: TodoEntry[] = [];
    for (const todo of previous) {
        next.push(incomingById.get(todo.id) ?? todo);
        seen.add(todo.id);
    }
    for (const todo of incoming) {
        if (!seen.has(todo.id)) {
            next.push(todo);
        }
    }
    return next;
}
