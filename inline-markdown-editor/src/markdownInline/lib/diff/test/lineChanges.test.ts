import { describe, expect, it } from "vite-plus/test";
import { paintForModified, paintForOriginal, textLineChanges } from "../lineChanges";

describe("textLineChanges", () => {
    it("marks an added line and maps the unchanged lines", () => {
        const changes = textLineChanges("a\nb\n", "a\nb\nc\n");

        expect(changes.modified.lines).toEqual([2]);
        expect(changes.original.lines).toEqual([]);
        expect(changes.removedBlocks).toEqual([]);
        expect(changes.originalToModified).toEqual([0, 1, 3]);
        expect(changes.modifiedToOriginal[2]).toBe(2);
    });

    it("marks a removed line and the place it leaves in the modified file", () => {
        const changes = textLineChanges("a\nb\nc\n", "a\nc\n");

        expect(changes.original.lines).toEqual([1]);
        expect(changes.modified.lines).toEqual([]);
        expect(changes.removedBlocks).toEqual([{ beforeLine: 1, text: "b" }]);
        expect(changes.originalToModified[1]).toBe(1);
        expect(changes.modifiedToOriginal).toEqual([0, 2, 3]);
    });

    it("marks the new characters on a changed line", () => {
        const changes = textLineChanges("hello\n", "hello world\n");

        expect(changes.modified.lines).toEqual([]);
        expect(changes.modified.inner).toEqual([{ line: 0, startColumn: 5, endColumn: 11 }]);
        expect(changes.original.inner).toEqual([]);
        expect(paintForModified(changes, true).kind).toBe("added");
    });

    it("marks a full line replacement on both sides", () => {
        const changes = textLineChanges("foo\n", "bar\n");

        expect(changes.original.lines).toEqual([0]);
        expect(changes.modified.lines).toEqual([0]);
        expect(changes.removedBlocks).toEqual([]);
        expect(paintForOriginal(changes).kind).toBe("removed");
        expect(paintForOriginal(changes).lines).toEqual([0]);
    });

    it("keeps an identical file free of marks", () => {
        const changes = textLineChanges("# Title\n\nBody\n", "# Title\n\nBody\n");

        expect(changes.original.lines).toEqual([]);
        expect(changes.modified.lines).toEqual([]);
        expect(changes.removedBlocks).toEqual([]);
        expect(changes.originalToModified).toEqual([0, 1, 2, 3]);
    });
});
