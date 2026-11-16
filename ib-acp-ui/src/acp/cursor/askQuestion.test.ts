import { describe, expect, it } from "vite-plus/test";
import {
    CURSOR_ASK_FREEFORM_OPTION_ID,
    displayAskQuestionOptions,
    isCatchAllAskQuestionOptionLabel,
    normalizeAskQuestionAnswers,
} from "./askQuestion";

describe("askQuestion", () => {
    it("strips a trailing Other option like Cursor CLI", () => {
        const options = displayAskQuestionOptions({
            options: [
                { id: "a", label: "First" },
                { id: "b", label: "Other: tell me more" },
            ],
        });
        expect(options.map((option) => option.label)).toEqual(["First"]);
    });

    it("detects catch-all labels", () => {
        expect(isCatchAllAskQuestionOptionLabel("Other")).toBe(true);
        expect(isCatchAllAskQuestionOptionLabel("something else (custom)")).toBe(true);
        expect(isCatchAllAskQuestionOptionLabel("Agent mode")).toBe(false);
    });

    it("passes freeform text through to Cursor", () => {
        expect(
            normalizeAskQuestionAnswers([
                {
                    questionId: "q1",
                    selectedOptionIds: [CURSOR_ASK_FREEFORM_OPTION_ID],
                    freeformText: "  Docs only  ",
                },
            ]),
        ).toEqual([
            {
                questionId: "q1",
                selectedOptionIds: [CURSOR_ASK_FREEFORM_OPTION_ID],
                freeformText: "Docs only",
            },
        ]);
    });
});
