import { describe, expect, it } from "vite-plus/test";
import { planMarkdownDirectoryName } from "./planMarkdownPath";

describe("planMarkdownDirectoryName", () => {
    it("builds a folder for the plan name and request", () => {
        expect(planMarkdownDirectoryName("Cloud band source", "cursor-create-plan-1")).toBe(
            "cloud-band-source-ateplan1",
        );
    });

    it("falls back when the plan has no name", () => {
        expect(planMarkdownDirectoryName(undefined, "plan-1")).toBe("plan1");
        expect(planMarkdownDirectoryName("   ", "")).toBe("plan");
    });
});
