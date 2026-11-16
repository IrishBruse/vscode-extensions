import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("CursorAskQuestionDialog", () => {
    it("uses paginated arrow selection instead of permission buttons", () => {
        const tsx = readFileSync(new URL("./CursorAskQuestionDialog.tsx", import.meta.url), "utf8");
        const css = readFileSync(new URL("./CursorAskQuestionDialog.css", import.meta.url), "utf8");
        expect(tsx).not.toContain("ib-permission-button");
        expect(tsx).toContain("cursor-ask-question__pointer");
        expect(tsx).toContain("Question");
        expect(tsx).toContain("ArrowLeft");
        expect(css).toContain(".cursor-ask-question");
        expect(css).toContain("var(--vscode-textLink-foreground)");
    });
});