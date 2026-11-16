import { describe, expect, it } from "vite-plus/test";
import {
    CURSOR_ASK_FREEFORM_OPTION_ID,
    displayAskQuestionOptions,
} from "../../../../../../../src/acp/cursor/askQuestion";
import { buildSubmitAnswers, rowsForQuestion, toggleRowSelection } from "./askQuestionUi";

describe("askQuestionUi", () => {
    const question = {
        id: "q1",
        prompt: "Pick one",
        allowMultiple: false as const,
        options: [
            { id: "a", label: "First" },
            { id: "b", label: "Other: custom" },
        ],
    };

    it("appends a freeform row and drops agent Other options", () => {
        expect(rowsForQuestion(question).map((row) => row.kind)).toEqual(["option", "freeform"]);
        expect(displayAskQuestionOptions(question).map((option) => option.label)).toEqual(["First"]);
    });

    it("maps a typed answer to Cursor freeform ids", () => {
        const answers = new Map([
            [
                "q1",
                {
                    selectedOptionIds: [CURSOR_ASK_FREEFORM_OPTION_ID],
                    freeformText: "Docs",
                },
            ],
        ]);
        expect(buildSubmitAnswers([question], answers)).toEqual([
            {
                questionId: "q1",
                selectedOptionIds: [CURSOR_ASK_FREEFORM_OPTION_ID],
                freeformText: "Docs",
            },
        ]);
    });

    it("replaces the selection on single-select answers", () => {
        const first = toggleRowSelection(
            question,
            { selectedOptionIds: [], freeformText: "" },
            { kind: "option", id: "a", label: "First" },
        );
        const second = toggleRowSelection(question, first, {
            kind: "option",
            id: "opt-b",
            label: "Second",
        });
        expect(second.selectedOptionIds).toEqual(["opt-b"]);
    });
});