import { describe, expect, it } from "vite-plus/test";
import {
    headingSlug,
    lineForHeadingFragment,
    resolveMarkdownLink,
    tryRevealHeadingFragment,
} from "../fragment";

describe("heading fragment links", () => {
    it("slugifies titles like GitHub", () => {
        expect(headingSlug("Install")).toBe("install");
        expect(headingSlug("  Hello World!  ")).toBe("hello-world");
    });

    it("finds a heading line for a fragment", () => {
        const text = "# Top\n\n## Install\n\nSteps\n\n## Install\n";
        expect(lineForHeadingFragment(text, "install")).toBe(2);
        expect(lineForHeadingFragment(text, "install-1")).toBe(6);
        expect(lineForHeadingFragment(text, "top")).toBe(0);
        expect(lineForHeadingFragment(text, "missing")).toBeUndefined();
    });

    it("resolves same-document links against the document url", () => {
        const base = "https://example.com/docs/readme.md";
        expect(resolveMarkdownLink("#install", base)).toEqual({
            sameDocument: true,
            fragment: "install",
        });
        expect(resolveMarkdownLink("other.md#install", base)).toEqual({
            sameDocument: false,
            fragment: "install",
        });
    });

    it("reveals in-document when the href targets a heading", () => {
        const lines: number[] = [];
        const revealed = tryRevealHeadingFragment(
            "README.md#install",
            "## Install\n",
            "https://x/README.md",
            (line) => {
                lines.push(line);
            },
        );
        expect(revealed).toBe(true);
        expect(lines).toEqual([0]);
    });
});
