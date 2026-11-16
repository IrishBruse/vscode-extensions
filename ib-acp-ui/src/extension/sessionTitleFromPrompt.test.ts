import { describe, expect, it } from "vite-plus/test";
import { isPlaceholderSessionTitle, sessionTitleFromPrompt } from "./sessionTitleFromPrompt";

describe("isPlaceholderSessionTitle", () => {
    it("treats New Cursor chat as a placeholder", () => {
        expect(isPlaceholderSessionTitle("New Cursor chat")).toBe(true);
    });

    it("treats a real title as not a placeholder", () => {
        expect(isPlaceholderSessionTitle("Fix login")).toBe(false);
    });
});

describe("sessionTitleFromPrompt", () => {
    it("uses the first line and collapses whitespace", () => {
        expect(sessionTitleFromPrompt("  Fix   login  \nsecond line")).toBe("Fix login");
    });

    it("returns empty for a blank prompt", () => {
        expect(sessionTitleFromPrompt("   \n\n")).toBe("");
    });

    it("truncates a long first line", () => {
        const long = "a".repeat(100);
        const title = sessionTitleFromPrompt(long);
        expect(title.endsWith("…")).toBe(true);
        expect(title.length).toBeLessThanOrEqual(80);
    });
});
