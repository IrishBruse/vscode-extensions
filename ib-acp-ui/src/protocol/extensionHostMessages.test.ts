import { describe, expect, it } from "vite-plus/test";
import { promptImagesFromUnknown, tryParseWebviewMessage } from "./extensionHostMessages";

describe("promptImagesFromUnknown", () => {
    it("keeps base64 image attachments", () => {
        expect(promptImagesFromUnknown([{ data: "QUJD", mimeType: "image/png" }])).toEqual([
            { data: "QUJD", mimeType: "image/png" },
        ]);
    });

    it("rejects non-image mime types and malformed rows", () => {
        expect(
            promptImagesFromUnknown([
                { data: "QUJD", mimeType: "text/plain" },
                { data: "", mimeType: "image/png" },
                { mimeType: "image/png" },
                "image/png",
                null,
            ]),
        ).toEqual([]);
    });

    it("caps the attachment count", () => {
        const rows = Array.from({ length: 12 }, () => ({ data: "QUJD", mimeType: "image/png" }));
        expect(promptImagesFromUnknown(rows).length).toBe(8);
    });
});

describe("tryParseWebviewMessage", () => {
    it("parses send without images", () => {
        expect(tryParseWebviewMessage({ type: "send", body: "hi" })).toEqual({
            type: "send",
            body: "hi",
        });
    });

    it("parses send with valid images", () => {
        expect(
            tryParseWebviewMessage({
                type: "send",
                body: "hi",
                images: [{ data: "QUJD", mimeType: "image/png" }],
            }),
        ).toEqual({
            type: "send",
            body: "hi",
            images: [{ data: "QUJD", mimeType: "image/png" }],
        });
    });

    it("drops invalid image lists", () => {
        expect(tryParseWebviewMessage({ type: "send", body: "hi", images: "nope" })).toEqual({
            type: "send",
            body: "hi",
        });
        expect(tryParseWebviewMessage({ type: "send", body: "hi", images: [] })).toEqual({
            type: "send",
            body: "hi",
        });
    });
});
