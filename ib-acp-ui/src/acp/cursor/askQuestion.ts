/** Cursor's synthetic "type your own answer" option id (interaction-utils `BU`). */
export const CURSOR_ASK_FREEFORM_OPTION_ID = "__freeform_other__";

export const CURSOR_ASK_FREEFORM_LABEL = "Other: (type to answer)";

export type CursorAskQuestionOption = {
    id: string;
    label: string;
};

export type CursorAskQuestionItem = {
    id: string;
    prompt: string;
    options: readonly CursorAskQuestionOption[];
    allowMultiple?: boolean;
};

export type CursorAskQuestionAnswer = {
    questionId: string;
    selectedOptionIds: string[];
    freeformText?: string;
};

/**
 * Cursor CLI drops a trailing catch-all option before rendering, because it
 * always appends its own freeform "Other" row.
 */
export function isCatchAllAskQuestionOptionLabel(label: string): boolean {
    const normalized = label.toLowerCase().trim();
    return (
        normalized === "other" ||
        normalized === "something else" ||
        normalized.startsWith("other:") ||
        normalized.startsWith("other -") ||
        normalized.startsWith("other (") ||
        normalized.startsWith("something else:") ||
        normalized.startsWith("something else -") ||
        normalized.startsWith("something else (")
    );
}

/** Options as Cursor would display them: trailing catch-all removed. */
export function displayAskQuestionOptions(
    question: Pick<CursorAskQuestionItem, "options">,
): CursorAskQuestionOption[] {
    const options = [...question.options];
    const last = options.at(-1);
    if (last !== undefined && isCatchAllAskQuestionOptionLabel(last.label)) {
        return options.slice(0, -1);
    }
    return options;
}

export function normalizeAskQuestionAnswers(
    answers: readonly CursorAskQuestionAnswer[],
): Array<Record<string, unknown>> {
    return answers.map((answer) => {
        const record: Record<string, unknown> = {
            questionId: answer.questionId,
            selectedOptionIds: answer.selectedOptionIds,
        };
        const freeform = answer.freeformText?.trim();
        if (freeform !== undefined && freeform.length > 0) {
            record.freeformText = freeform;
        }
        return record;
    });
}
