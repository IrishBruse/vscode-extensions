import type { AskQuestionPromptState } from "../../../../chatReducer";
import {
    CURSOR_ASK_FREEFORM_OPTION_ID,
    displayAskQuestionOptions,
    type CursorAskQuestionAnswer,
} from "../../../../../../../src/acp/cursor/askQuestion";

export type AskQuestionRow =
    | { kind: "option"; id: string; label: string }
    | { kind: "freeform" };

export type StoredQuestionAnswer = {
    selectedOptionIds: string[];
    freeformText: string;
};

export function rowsForQuestion(
    question: AskQuestionPromptState["questions"][number],
): AskQuestionRow[] {
    const options = displayAskQuestionOptions(question).map((option) => ({
        kind: "option" as const,
        id: option.id,
        label: option.label,
    }));
    return [...options, { kind: "freeform" }];
}

export function isRowSelected(
    _question: AskQuestionPromptState["questions"][number],
    answer: StoredQuestionAnswer,
    row: AskQuestionRow,
): boolean {
    if (row.kind === "freeform") {
        return answer.selectedOptionIds.includes(CURSOR_ASK_FREEFORM_OPTION_ID);
    }
    return answer.selectedOptionIds.includes(row.id);
}

export function toggleRowSelection(
    question: AskQuestionPromptState["questions"][number],
    answer: StoredQuestionAnswer,
    row: AskQuestionRow,
): StoredQuestionAnswer {
    if (row.kind === "freeform") {
        return {
            selectedOptionIds: [CURSOR_ASK_FREEFORM_OPTION_ID],
            freeformText: answer.freeformText,
        };
    }
    if (question.allowMultiple === true) {
        const on = answer.selectedOptionIds.includes(row.id);
        const withoutFreeform = answer.selectedOptionIds.filter(
            (id) => id !== CURSOR_ASK_FREEFORM_OPTION_ID,
        );
        return {
            selectedOptionIds: on
                ? withoutFreeform.filter((id) => id !== row.id)
                : [...withoutFreeform, row.id],
            freeformText: "",
        };
    }
    return {
        selectedOptionIds: [row.id],
        freeformText: "",
    };
}

export function emptyAnswers(
    questions: AskQuestionPromptState["questions"],
): Map<string, StoredQuestionAnswer> {
    const map = new Map<string, StoredQuestionAnswer>();
    for (const question of questions) {
        map.set(question.id, { selectedOptionIds: [], freeformText: "" });
    }
    return map;
}

export function buildSubmitAnswers(
    questions: AskQuestionPromptState["questions"],
    answers: ReadonlyMap<string, StoredQuestionAnswer>,
): CursorAskQuestionAnswer[] {
    return questions.map((question) => {
        const stored = answers.get(question.id) ?? { selectedOptionIds: [], freeformText: "" };
        const freeformText = stored.freeformText.trim();
        const usesFreeform = stored.selectedOptionIds.includes(CURSOR_ASK_FREEFORM_OPTION_ID);
        return {
            questionId: question.id,
            selectedOptionIds: usesFreeform
                ? [CURSOR_ASK_FREEFORM_OPTION_ID]
                : stored.selectedOptionIds,
            ...(usesFreeform
                ? { freeformText: freeformText.length > 0 ? freeformText : "Other" }
                : {}),
        };
    });
}