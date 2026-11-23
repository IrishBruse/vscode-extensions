import { describe, expect, it } from "vite-plus/test";
import { splitHttpUrls } from "./httpUrlText";

describe("splitHttpUrls", () => {
    it("keeps text with no URL as one span", () => {
        expect(splitHttpUrls("no link here")).toEqual([{ kind: "text", text: "no link here" }]);
    });

    it("splits a URL and leaves the trailing period in the text", () => {
        expect(splitHttpUrls("See https://recomplauncher.com/sdk-files/guide-part-1.md.")).toEqual([
            { kind: "text", text: "See " },
            {
                kind: "url",
                text: "https://recomplauncher.com/sdk-files/guide-part-1.md",
                url: "https://recomplauncher.com/sdk-files/guide-part-1.md",
            },
            { kind: "text", text: "." },
        ]);
    });

    it("splits more than one URL", () => {
        const spans = splitHttpUrls(
            "Part 2: https://recomplauncher.com/sdk-files/guide-part-2.md and https://example.com/a",
        );
        expect(spans.filter((span) => span.kind === "url").map((span) => span.url)).toEqual([
            "https://recomplauncher.com/sdk-files/guide-part-2.md",
            "https://example.com/a",
        ]);
    });
});
