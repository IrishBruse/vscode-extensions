import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { openPlayground } from "../../test/support/browser";
import type { Browser, Page } from "playwright-core";

const fixture = "diff/test/fixtures/case-1.md";

describe("diff line color", () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
        const opened = await openPlayground(fixture, "Changed line");
        browser = opened.browser;
        page = opened.page;
        await page.evaluate(() => {
            const editor = (
                window as unknown as {
                    __inlineMarkdown: {
                        setDiff(diff: {
                            kind: "added";
                            lines: number[];
                            inner: [];
                            removedBlocks: { beforeLine: number; text: string }[];
                        }): void;
                    };
                }
            ).__inlineMarkdown;
            editor.setDiff({
                kind: "added",
                lines: [2],
                inner: [],
                removedBlocks: [{ beforeLine: 1, text: "Old line" }],
            });
        });
        await page.waitForFunction(
            () => document.querySelector(".inline-md-diff-added") instanceof HTMLElement,
        );
    });

    afterAll(async () => {
        await browser?.close();
    });

    it("paints a changed line with the diff color", async () => {
        const background = await page.evaluate(() => {
            const node = document.querySelector(".inline-md-diff-added");
            return node ? getComputedStyle(node).backgroundColor : "";
        });
        expect(background).not.toBe("");
        expect(background).not.toBe("rgba(0, 0, 0, 0)");
    });

    it("keeps a removed line visible above the next line", async () => {
        const text = await page.locator(".inline-md-diff-removed").innerText();
        expect(text).toContain("Old line");
    });
});
