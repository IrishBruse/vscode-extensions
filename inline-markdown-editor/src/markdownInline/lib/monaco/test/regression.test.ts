import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import type { Browser, Page } from "playwright-core";
import { openPlayground } from "../../test/support/browser";

const macUserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const text = "one two three";

describe("macOS word movement", () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
        const opened = await openPlayground("monaco/test/fixtures/case-1.md", "one two three", {
            userAgent: macUserAgent,
        });
        browser = opened.browser;
        page = opened.page;
    });

    afterAll(async () => {
        await browser?.close();
    });

    it("jumps a word on Command+Left", async () => {
        const cursor = await page.evaluate(async (value) => {
            const api = window.__inlineMarkdown;
            api.setDocument(value);
            api.setCursor(value.indexOf("wo"));
            api.focus();
            return api.getCursor();
        }, text);
        expect(cursor).toBe(text.indexOf("wo"));
        await page.keyboard.press("Meta+ArrowLeft");
        const moved = await page.evaluate(() => window.__inlineMarkdown.getCursor());
        expect(moved).toBe(text.indexOf("two"));

        await page.keyboard.press("Meta+ArrowRight");
        const wordEnd = await page.evaluate(() => window.__inlineMarkdown.getCursor());
        expect(wordEnd).toBe(text.indexOf(" three"));

        await page.keyboard.press("Shift+Meta+ArrowLeft");
        await page.keyboard.type("X");
        const selected = await page.evaluate(() => window.__inlineMarkdown.getDocument());
        expect(selected).toBe("one X three");

        await page.evaluate((value) => {
            const api = window.__inlineMarkdown;
            api.setDocument(value);
            api.setCursor(value.indexOf(" three"));
            api.focus();
        }, text);
        await page.keyboard.press("Meta+Backspace");
        const deleted = await page.evaluate(() => window.__inlineMarkdown.getDocument());
        expect(deleted).toBe("one  three");

        const lines = "one two three\nsecond line";
        const stayed = await page.evaluate((value) => {
            const api = window.__inlineMarkdown;
            api.setDocument(value);
            const offset = value.indexOf("second");
            api.setCursor(offset);
            api.focus();
            return offset;
        }, lines);
        await page.keyboard.press("Meta+ArrowUp");
        const afterUp = await page.evaluate(() => window.__inlineMarkdown.getCursor());
        expect(afterUp).toBe(stayed);
    });
});
