import { describe, expect, it } from "vite-plus/test";
import { computeToolCallDiffRows } from "./toolCallDiffLines";

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
