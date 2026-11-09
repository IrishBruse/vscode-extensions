import { describe, expect, it } from "vite-plus/test";
import { subagentTaskViewFromTool, taskToolFieldsFromRaw } from "./taskToolPresentation";

const prompt =
    "Decompile cursor Back call\nReturn the declaration, the body, and a short description of what value 2 does to the cursor.";

describe("taskToolFieldsFromRaw", () => {
    it("reads a Cursor task rawInput object", () => {
        expect(
            taskToolFieldsFromRaw({
                _toolName: "task",
                prompt,
                description: "Decompile cursor Back call",
                subagentType: "generalPurpose",
            }),
        ).toEqual({
            description: "Decompile cursor Back call",
            prompt,
            subagentType: "generalPurpose",
        });
    });
});

describe("subagentTaskViewFromTool", () => {
    it("turns a dumped task JSON subtitle into a description and a prompt", () => {
        const view = subagentTaskViewFromTool({
            title: "Task: Decompile cursor Back call",
            subtitle: JSON.stringify({
                _toolName: "task",
                prompt,
                description: "Decompile cursor Back call",
                subagentType: "generalPurpose",
            }),
            content: JSON.stringify({ durationMs: 1200, isBackground: false }),
        });
        expect(view).toEqual({
            description: "Decompile cursor Back call",
            prompt,
            subagentType: "generalPurpose",
            durationMs: 1200,
        });
        expect(view?.prompt).not.toContain("\\n");
        expect(view?.prompt).not.toContain('"description"');
    });

    it("reads the mapped subtitle type and prompt content", () => {
        expect(
            subagentTaskViewFromTool({
                title: "Task: Decompile cursor Back call",
                subtitle: "generalPurpose",
                content: prompt,
                durationMs: 1200,
            }),
        ).toEqual({
            description: "Decompile cursor Back call",
            prompt,
            subagentType: "generalPurpose",
            durationMs: 1200,
        });
    });
});
