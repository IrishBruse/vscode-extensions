import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactElement,
} from "react";
import type { AskQuestionPromptState } from "../../../../chatReducer";
import { CURSOR_ASK_FREEFORM_OPTION_ID } from "../../../../../../../src/acp/cursor/askQuestion";
import {
    buildSubmitAnswers,
    emptyAnswers,
    isRowSelected,
    rowsForQuestion,
    toggleRowSelection,
    type StoredQuestionAnswer,
} from "./askQuestionUi";
import "./CursorAskQuestionDialog.css";

export function CursorAskQuestionDialog({
    request,
    onSubmit,
    onSkip,
}: {
    request: AskQuestionPromptState;
    onSubmit: (answers: ReturnType<typeof buildSubmitAnswers>) => void;
    onSkip: () => void;
}): ReactElement {
    const [questionIndex, setQuestionIndex] = useState(0);
    const [focusIndex, setFocusIndex] = useState(0);
    const [answers, setAnswers] = useState(() => emptyAnswers(request.questions));
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const question = request.questions[questionIndex];
    const rows = useMemo(() => (question === undefined ? [] : rowsForQuestion(question)), [question]);
    const answer = question === undefined ? undefined : answers.get(question.id);
    const freeformRowIndex = rows.length > 0 ? rows.length - 1 : -1;
    const onFreeformRow = focusIndex === freeformRowIndex;

    useEffect(() => {
        setQuestionIndex(0);
        setFocusIndex(0);
        setAnswers(emptyAnswers(request.questions));
    }, [request.requestId, request.questions]);

    useEffect(() => {
        setFocusIndex(0);
    }, [questionIndex]);

    useEffect(() => {
        panelRef.current?.focus();
    }, [questionIndex, request.requestId]);

    useEffect(() => {
        if (onFreeformRow) {
            inputRef.current?.focus();
        }
    }, [onFreeformRow, focusIndex, questionIndex]);

    const updateAnswer = useCallback((questionId: string, next: StoredQuestionAnswer) => {
        setAnswers((prev) => {
            const map = new Map(prev);
            map.set(questionId, next);
            return map;
        });
    }, []);

    const submitAll = useCallback(() => {
        onSubmit(buildSubmitAnswers(request.questions, answers));
    }, [answers, onSubmit, request.questions]);

    const onKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (question === undefined || answer === undefined) {
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                onSkip();
                return;
            }
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                setQuestionIndex((index) => Math.max(0, index - 1));
                return;
            }
            if (event.key === "ArrowRight") {
                event.preventDefault();
                setQuestionIndex((index) => Math.min(request.questions.length - 1, index + 1));
                return;
            }
            if (event.key === "ArrowUp") {
                event.preventDefault();
                setFocusIndex((index) => Math.max(0, index - 1));
                panelRef.current?.focus();
                return;
            }
            if (event.key === "ArrowDown") {
                event.preventDefault();
                setFocusIndex((index) => Math.min(rows.length - 1, index + 1));
                panelRef.current?.focus();
                return;
            }
            if (event.key === " ") {
                const target = event.target;
                if (target instanceof HTMLInputElement) {
                    return;
                }
                event.preventDefault();
                const row = rows[focusIndex];
                if (row === undefined) {
                    return;
                }
                updateAnswer(question.id, toggleRowSelection(question, answer, row));
                return;
            }
            if (event.key === "Enter") {
                const target = event.target;
                if (target instanceof HTMLInputElement) {
                    event.preventDefault();
                    if (questionIndex < request.questions.length - 1) {
                        setQuestionIndex((index) => index + 1);
                        return;
                    }
                    submitAll();
                    return;
                }
                event.preventDefault();
                if (questionIndex < request.questions.length - 1) {
                    setQuestionIndex((index) => index + 1);
                    return;
                }
                submitAll();
            }
        },
        [
            answer,
            focusIndex,
            onSkip,
            question,
            questionIndex,
            request.questions.length,
            rows,
            submitAll,
            updateAnswer,
        ],
    );

    if (question === undefined || answer === undefined) {
        return <div />;
    }

    return (
        <div className="cursor-ask-question-backdrop" role="presentation">
            <div
                ref={panelRef}
                className="cursor-ask-question"
                role="dialog"
                aria-modal="true"
                aria-label={request.title?.trim() || "Question from agent"}
                tabIndex={-1}
                onKeyDown={onKeyDown}
            >
                <h2 className="cursor-ask-question__title">
                    {request.title?.trim() || "Question from agent"}
                </h2>
                <p className="cursor-ask-question__progress">
                    Question {questionIndex + 1} of {request.questions.length}
                </p>
                <p className="cursor-ask-question__prompt">
                    {questionIndex + 1}. {question.prompt}
                </p>
                <ul className="cursor-ask-question__list" role="listbox" aria-label={question.prompt}>
                    {rows.map((row, index) => {
                        const focused = index === focusIndex;
                        const selected = isRowSelected(question, answer, row);
                        return (
                            <li
                                key={row.kind === "option" ? row.id : "freeform"}
                                className={
                                    focused
                                        ? "cursor-ask-question__row is-focused"
                                        : "cursor-ask-question__row"
                                }
                                role="option"
                                aria-selected={selected}
                            >
                                <span className="cursor-ask-question__pointer" aria-hidden="true">
                                    {focused ? "›" : ""}
                                </span>
                                <span className="cursor-ask-question__mark" aria-hidden="true">
                                    {selected ? "[x]" : "[ ]"}
                                </span>
                                {row.kind === "option" ? (
                                    <span className="cursor-ask-question__label">{row.label}</span>
                                ) : (
                                    <span className="cursor-ask-question__freeform">
                                        <span>Other:</span>
                                        <input
                                            ref={inputRef}
                                            className="cursor-ask-question__input"
                                            type="text"
                                            value={answer.freeformText}
                                            placeholder="(type to answer)"
                                            aria-label="Custom answer"
                                            onChange={(event) => {
                                                updateAnswer(question.id, {
                                                    selectedOptionIds: [CURSOR_ASK_FREEFORM_OPTION_ID],
                                                    freeformText: event.target.value,
                                                });
                                                setFocusIndex(freeformRowIndex);
                                            }}
                                            onFocus={() => {
                                                setFocusIndex(freeformRowIndex);
                                            }}
                                        />
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
                <p className="cursor-ask-question__hints">
                    ↑/↓ option · ←/→ question · Space select · Enter next/submit · Esc to skip
                </p>
            </div>
        </div>
    );
}