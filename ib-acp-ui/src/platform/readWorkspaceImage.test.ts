import { describe, expect, it } from "vite-plus/test";
import { imagePreviewTargetFromMessage } from "../acp/mapping/imageToolPreview";
import { isImageFilePath } from "./imageFilePath";
import { readWorkspaceImage } from "./readWorkspaceImage";

describe("isImageFilePath", () => {
    it("matches image extensions and ignores other files", () => {
        expect(isImageFilePath(".tmp/playtest/06-continue-a.png")).toBe(true);
        expect(isImageFilePath("shot.JPEG")).toBe(true);
        expect(isImageFilePath("notes.md")).toBe(false);
        expect(isImageFilePath("foo.png lines 1-2")).toBe(true);
    });
});

describe("readWorkspaceImage", () => {
    it("returns a preview for an image file", async () => {
        const image = await readWorkspaceImage("shots/a.png", "/work", async (path) => {
            expect(path).toBe("/work/shots/a.png");
            return new Uint8Array([1, 2, 3]);
        });
        expect(image).toEqual({ data: "AQID", mimeType: "image/png" });
    });

    it("skips missing files and non-images", async () => {
        expect(
            await readWorkspaceImage("a.ts", "/work", async () => new Uint8Array([1])),
        ).toBeUndefined();
        expect(
            await readWorkspaceImage("a.png", "/work", async () => {
                throw new Error("missing");
            }),
        ).toBeUndefined();
    });
});

describe("imagePreviewTargetFromMessage", () => {
    it("targets a read of an image that has no bytes yet", () => {
        expect(
            imagePreviewTargetFromMessage({
                type: "appendToolCall",
                toolCallId: "read-1",
                title: "Read",
                kind: "read",
                subtitle: ".tmp/shot.png",
            }),
        ).toEqual({ toolCallId: "read-1", path: ".tmp/shot.png" });
        expect(
            imagePreviewTargetFromMessage({
                type: "appendToolCall",
                toolCallId: "read-1",
                title: "Read",
                kind: "read",
                subtitle: ".tmp/shot.png",
                image: { data: "QUJD", mimeType: "image/png" },
            }),
        ).toBeUndefined();
        expect(
            imagePreviewTargetFromMessage({
                type: "subagentActivity",
                sessionId: "child",
                event: {
                    type: "updateToolCall",
                    toolCallId: "read-2",
                    status: "completed",
                    subtitle: "frame.webp",
                },
            }),
        ).toEqual({ toolCallId: "read-2", path: "frame.webp", sessionId: "child" });
    });
});
