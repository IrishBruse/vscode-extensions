import { describe, expect, it } from "vite-plus/test";
import type { ToolCallDiffRow } from "../../protocol/extensionHostMessages";
import { computeToolCallDiffRows, previewDiffRows } from "./toolCallDiffLines";

describe("computeToolCallDiffRows", () => {
    it("shows the edit with a few lines above and below", () => {
        const oldLines = Array.from({ length: 80 }, (_, index) => `line ${index}`);
        const newLines = [...oldLines];
        newLines[40] = "changed line";
        const rows = computeToolCallDiffRows(oldLines.join("\n"), newLines.join("\n"));
        const changedAt = rows.findIndex(
            (row) => row.kind === "added" && row.text === "changed line",
        );

        expect(changedAt).toBeGreaterThanOrEqual(0);
        expect(rows.some((row) => row.kind === "removed" && row.text === "line 40")).toBe(true);
        expect(rows.some((row) => row.text === "line 0")).toBe(false);
        expect(rows.some((row) => row.text === "line 79")).toBe(false);
        expect(rows.length).toBeLessThanOrEqual(12);
        expect(changedAt).toBeLessThanOrEqual(4);
    });
});

describe("previewDiffRows", () => {
    it("drops leading context when the whole hunk already fits the preview height", () => {
        const rows: ToolCallDiffRow[] = [
            { kind: "context", text: "  padding: 0;" },
            { kind: "context", text: "  border: none;" },
            { kind: "context", text: "  background: transparent;" },
            { kind: "removed", text: "  font-family: var(--acp-ui-font-mono);" },
            { kind: "context", text: "  color: var(--acp-ui-text-primary);" },
            { kind: "context", text: "}" },
        ];
        const preview = previewDiffRows(rows, 6);

        expect(preview[0]?.kind).toBe("removed");
        expect(preview.some((row) => row.text === "  padding: 0;")).toBe(false);
    });

    it("centers the collapsed window on edits instead of file-start context", () => {
        const rows: ToolCallDiffRow[] = [
            { kind: "context", text: "}" },
            { kind: "context", text: "" },
            { kind: "context", text: "/**" },
            {
                kind: "removed",
                text: " * Renders a compact model-thought chunk as a dim terminal-style block.",
            },
            {
                kind: "added",
                text: " * Renders a compact model-thought chunk with markdown body text.",
            },
            { kind: "context", text: " * The heading toggles the thought text." },
            { kind: "context", text: " */" },
            { kind: "context", text: "export function AgentThoughtBlock" },
        ];
        const preview = previewDiffRows(rows, 6);

        expect(preview[0]?.kind).toBe("removed");
        expect(preview.some((row) => row.kind === "added")).toBe(true);
        expect(preview.some((row) => row.text === "}")).toBe(false);
    });

    it("favors the hunk with more edits when distant changes are separated by ellipsis", () => {
        const rows: ToolCallDiffRow[] = [
            { kind: "context", text: "  padding: 0;" },
            { kind: "context", text: "  border: none;" },
            { kind: "removed", text: "  font-family: var(--acp-ui-font-mono);" },
            { kind: "context", text: "}" },
            { kind: "context", text: "…" },
            { kind: "context", text: ".agent-thought-chunk-body {" },
            { kind: "removed", text: "  white-space: pre-wrap;" },
            { kind: "removed", text: "  word-break: break-word;" },
            { kind: "added", text: "" },
            { kind: "added", text: ".agent-thought-chunk-body .agent-markdown-pending {" },
            { kind: "added", text: "  font-family: var(--acp-ui-font-sans);" },
            { kind: "context", text: "}" },
        ];
        const preview = previewDiffRows(rows, 6);

        expect(
            preview.some(
                (row) => row.text === ".agent-thought-chunk-body .agent-markdown-pending {",
            ),
        ).toBe(true);
        expect(preview.some((row) => row.kind === "added" || row.kind === "removed")).toBe(true);
        expect(preview.some((row) => row.text === "  padding: 0;")).toBe(false);
    });
});
