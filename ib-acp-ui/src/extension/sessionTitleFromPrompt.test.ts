import { describe, expect, it } from "vite-plus/test";
import {
    isPlaceholderSessionTitle,
    sessionTitleFromPrompt,
    shouldDeriveSessionTitleFromPrompt,
    shouldPublishSessionFileTitle,
    titleAfterSessionFileReload,
} from "./sessionTitleFromPrompt";

describe("isPlaceholderSessionTitle", () => {
    it("treats New Cursor chat as a placeholder", () => {
        expect(isPlaceholderSessionTitle("New Cursor chat")).toBe(true);
    });

    it("treats a real title as not a placeholder", () => {
        expect(isPlaceholderSessionTitle("Fix login")).toBe(false);
    });
});

describe("shouldDeriveSessionTitleFromPrompt", () => {
    const cursor = { name: "Cursor", command: "agent", args: ["acp"] };
    const gemini = { name: "Gemini", command: "gemini", args: ["--stdio"] };

    it("waits for Cursor session_info_update instead of the first prompt", () => {
        expect(shouldDeriveSessionTitleFromPrompt("New Cursor chat", cursor)).toBe(false);
    });

    it("allows a prompt fallback for other agents while the title is still a placeholder", () => {
        expect(shouldDeriveSessionTitleFromPrompt("New Gemini chat", gemini)).toBe(true);
    });

    it("skips prompt fallback once a real title is stored", () => {
        expect(shouldDeriveSessionTitleFromPrompt("Fix login", cursor)).toBe(false);
        expect(shouldDeriveSessionTitleFromPrompt("Fix login", gemini)).toBe(false);
    });
});

describe("shouldPublishSessionFileTitle", () => {
    it("keeps the agent title when the file still says New Cursor chat", () => {
        expect(shouldPublishSessionFileTitle("Fix login", "New Cursor chat")).toBe(false);
    });

    it("applies a real title from the file", () => {
        expect(shouldPublishSessionFileTitle("New Cursor chat", "Fix login")).toBe(true);
        expect(shouldPublishSessionFileTitle("Fix login", "Rename me")).toBe(true);
    });
});

describe("titleAfterSessionFileReload", () => {
    it("keeps the agent title when the file on disk is still the placeholder", () => {
        expect(titleAfterSessionFileReload("Fix login", "New Cursor chat")).toBe("Fix login");
    });

    it("uses the title on disk when that title is real", () => {
        expect(titleAfterSessionFileReload("Fix login", "Rename me")).toBe("Rename me");
        expect(titleAfterSessionFileReload(undefined, "New Cursor chat")).toBe("New Cursor chat");
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
