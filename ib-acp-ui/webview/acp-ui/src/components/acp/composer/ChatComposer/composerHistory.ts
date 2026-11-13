export type HistoryRecall = {
  /**
   * Index of the history entry on screen.
   * `-1` means the user edited that entry and the walk is paused.
   */
  pointer: number;
  /** Composer text from before Arrow Up. */
  stashedDraft: string;
};

export function historyCaretAtStart(selectionStart: number, selectionEnd: number): boolean {
  return selectionStart === selectionEnd && selectionStart === 0;
}

export function historyCaretOnLastLine(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): boolean {
  if (selectionStart !== selectionEnd) {
    return false;
  }
  return !value.slice(selectionStart).includes("\n");
}

/**
 * Arrow Up recalls an older prompt.
 * The first press keeps the current composer text.
 * A later press does not replace that saved text.
 * Returns null when the caret should move instead.
 */
export function recallOlderDraft(input: {
  draft: string;
  history: readonly string[];
  recall: HistoryRecall | null;
  caretAtStart: boolean;
}): { draft: string; recall: HistoryRecall } | null {
  const { draft, history, recall, caretAtStart } = input;
  if (history.length === 0) {
    return null;
  }
  if (recall !== null && recall.pointer > 0) {
    const pointer = recall.pointer - 1;
    return {
      draft: history[pointer] ?? "",
      recall: { pointer, stashedDraft: recall.stashedDraft },
    };
  }
  if (recall !== null && recall.pointer === 0) {
    return { draft, recall };
  }
  if (recall !== null) {
    const pointer = history.length - 1;
    return {
      draft: history[pointer] ?? "",
      recall: { pointer, stashedDraft: recall.stashedDraft },
    };
  }
  if (!caretAtStart) {
    return null;
  }
  const pointer = history.length - 1;
  return {
    draft: history[pointer] ?? "",
    recall: { pointer, stashedDraft: draft },
  };
}

/**
 * Arrow Down walks toward the saved composer text and then puts it back.
 * After an edit, Down puts it back only when the caret is on the last line.
 */
export function recallNewerDraft(input: {
  draft: string;
  history: readonly string[];
  recall: HistoryRecall | null;
  caretOnLastLine: boolean;
}): { draft: string; recall: HistoryRecall | null } | null {
  const { history, recall, caretOnLastLine } = input;
  if (recall === null) {
    return null;
  }
  if (recall.pointer >= 0 && recall.pointer < history.length - 1) {
    const pointer = recall.pointer + 1;
    return {
      draft: history[pointer] ?? "",
      recall: { pointer, stashedDraft: recall.stashedDraft },
    };
  }
  if (recall.pointer < 0 && !caretOnLastLine) {
    return null;
  }
  return { draft: recall.stashedDraft, recall: null };
}

/** An edit keeps the saved composer text and pauses the history walk. */
export function recallAfterDraftEdit(
  recall: HistoryRecall | null,
  nextDraft: string,
  history: readonly string[],
): HistoryRecall | null {
  if (recall === null) {
    return null;
  }
  if (recall.pointer >= 0 && history[recall.pointer] === nextDraft) {
    return recall;
  }
  if (nextDraft === recall.stashedDraft) {
    return null;
  }
  return { pointer: -1, stashedDraft: recall.stashedDraft };
}

/** Ctrl+Z or Cmd+Z puts the saved composer text back. */
export function undoToStashedDraft(
  draft: string,
  recall: HistoryRecall | null,
): { draft: string; recall: null } | null {
  if (recall === null || draft === recall.stashedDraft) {
    return null;
  }
  return { draft: recall.stashedDraft, recall: null };
}
