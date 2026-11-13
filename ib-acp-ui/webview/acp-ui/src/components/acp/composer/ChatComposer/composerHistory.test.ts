import { describe, expect, it } from "vite-plus/test";
import {
  historyCaretAtStart,
  historyCaretOnLastLine,
  recallAfterDraftEdit,
  recallNewerDraft,
  recallOlderDraft,
  undoToStashedDraft,
} from "./composerHistory";

const history = ["older", "newer"];

describe("recallOlderDraft", () => {
  it("keeps the composer text on the first Arrow Up", () => {
    expect(
      recallOlderDraft({
        draft: "in progress",
        history,
        recall: null,
        caretAtStart: true,
      }),
    ).toEqual({
      draft: "newer",
      recall: { pointer: 1, stashedDraft: "in progress" },
    });
  });

  it("does not replace the composer when the caret is not at the start", () => {
    expect(
      recallOlderDraft({
        draft: "in progress",
        history,
        recall: null,
        caretAtStart: false,
      }),
    ).toBeNull();
  });

  it("walks older and keeps the same saved text", () => {
    expect(
      recallOlderDraft({
        draft: "newer",
        history,
        recall: { pointer: 1, stashedDraft: "in progress" },
        caretAtStart: false,
      }),
    ).toEqual({
      draft: "older",
      recall: { pointer: 0, stashedDraft: "in progress" },
    });
  });

  it("does not replace the saved text after an edit", () => {
    expect(
      recallOlderDraft({
        draft: "newer plus a note",
        history,
        recall: { pointer: -1, stashedDraft: "in progress" },
        caretAtStart: true,
      }),
    ).toEqual({
      draft: "newer",
      recall: { pointer: 1, stashedDraft: "in progress" },
    });
  });
});

describe("recallNewerDraft", () => {
  it("puts the saved composer text back after the newest entry", () => {
    expect(
      recallNewerDraft({
        draft: "newer",
        history,
        recall: { pointer: 1, stashedDraft: "in progress" },
        caretOnLastLine: true,
      }),
    ).toEqual({ draft: "in progress", recall: null });
  });

  it("walks forward before it restores the saved text", () => {
    expect(
      recallNewerDraft({
        draft: "older",
        history,
        recall: { pointer: 0, stashedDraft: "in progress" },
        caretOnLastLine: false,
      }),
    ).toEqual({
      draft: "newer",
      recall: { pointer: 1, stashedDraft: "in progress" },
    });
  });

  it("puts the saved text back from the last line after an edit", () => {
    expect(
      recallNewerDraft({
        draft: "newer plus a note",
        history,
        recall: { pointer: -1, stashedDraft: "in progress" },
        caretOnLastLine: true,
      }),
    ).toEqual({ draft: "in progress", recall: null });
  });

  it("lets the caret move after an edit when a line remains below", () => {
    expect(
      recallNewerDraft({
        draft: "line\nline",
        history,
        recall: { pointer: -1, stashedDraft: "in progress" },
        caretOnLastLine: false,
      }),
    ).toBeNull();
  });
});

describe("recallAfterDraftEdit", () => {
  it("keeps the saved text when the recalled prompt changes", () => {
    expect(
      recallAfterDraftEdit({ pointer: 1, stashedDraft: "in progress" }, "newer!", history),
    ).toEqual({ pointer: -1, stashedDraft: "in progress" });
  });

  it("clears the walk when the draft is the saved text again", () => {
    expect(
      recallAfterDraftEdit({ pointer: -1, stashedDraft: "in progress" }, "in progress", history),
    ).toBeNull();
  });
});

describe("undoToStashedDraft", () => {
  it("puts the saved composer text back", () => {
    expect(undoToStashedDraft("newer", { pointer: 1, stashedDraft: "in progress" })).toEqual({
      draft: "in progress",
      recall: null,
    });
  });

  it("leaves native undo alone when the saved text is already on screen", () => {
    expect(undoToStashedDraft("in progress", { pointer: -1, stashedDraft: "in progress" })).toBeNull();
  });
});

describe("history caret", () => {
  it("detects the start and the last line", () => {
    expect(historyCaretAtStart(0, 0)).toBe(true);
    expect(historyCaretAtStart(1, 1)).toBe(false);
    expect(historyCaretOnLastLine("a\nb", 2, 2)).toBe(true);
    expect(historyCaretOnLastLine("a\nb", 0, 0)).toBe(false);
  });
});
