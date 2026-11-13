import { describe, expect, it } from "vite-plus/test";
import {
    customLabelPatternsEqual,
    customLabelTemplate,
    mergeOwnedCustomLabelPatterns,
} from "./acpUiEditorTabLabel";

describe("customLabelTemplate", () => {
    it("keeps a chat title as the tab label", () => {
        expect(customLabelTemplate("Fix the login")).toBe("Fix the login");
    });

    it("stops a title from using a path token", () => {
        expect(customLabelTemplate("cost ${filename}")).toBe("cost $\u200b{filename}");
    });

    it("skips a title with no letter or digit", () => {
        expect(customLabelTemplate("…")).toBeUndefined();
    });
});

describe("mergeOwnedCustomLabelPatterns", () => {
    it("replaces owned chat paths and keeps other patterns", () => {
        const merged = mergeOwnedCustomLabelPatterns(
            {
                "/chats/old.acp": "Old title",
                "**/*.ts": "${filename}",
            },
            ["/chats/old.acp"],
            new Map([["/chats/new.acp", "New title"]]),
        );
        expect(merged.patterns).toEqual({
            "**/*.ts": "${filename}",
            "/chats/new.acp": "New title",
        });
        expect(merged.owned).toEqual(["/chats/new.acp"]);
    });

    it("does not replace a pattern the user already set", () => {
        const merged = mergeOwnedCustomLabelPatterns(
            { "/chats/mine.acp": "User label" },
            [],
            new Map([["/chats/mine.acp", "Stored title"]]),
        );
        expect(merged.patterns).toEqual({ "/chats/mine.acp": "User label" });
        expect(merged.owned).toEqual([]);
    });
});

describe("customLabelPatternsEqual", () => {
    it("matches the same keys and values", () => {
        expect(customLabelPatternsEqual({ a: "1" }, { a: "1" })).toBe(true);
        expect(customLabelPatternsEqual({ a: "1" }, { a: "2" })).toBe(false);
    });
});
