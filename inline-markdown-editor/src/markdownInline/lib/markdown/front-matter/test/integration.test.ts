import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { openPlayground } from "../../../test/support/browser";
import type { Browser, Page } from "playwright-core";

const fixture = "markdown/front-matter/test/fixtures/case-1.md";

describe("normal markdown front matter", () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
        const opened = await openPlayground(fixture, "title: Notes");
        browser = opened.browser;
        page = opened.page;
    });

    afterAll(async () => {
        await browser?.close();
    });

    it("keeps the YAML front matter in the editor and previews a later rule", async () => {
        const text = (await page.locator("#editor .view-lines").innerText()).replaceAll(
            "\u00a0",
            " ",
        );
        expect(text).toContain("title: Notes");
        expect(text).toContain("draft: false");
        const dashLines = text.split("\n").filter((line) => line.includes("---"));
        expect(dashLines).toHaveLength(2);
        expect(await page.locator("#editor .inline-md-hr").count()).toBe(1);
    });

    it("colors keys, strings, and booleans as YAML", async () => {
        const colors = await page.waitForFunction(() => {
            const fold = (value: string | null) => (value ?? "").replaceAll("\u00a0", " ");
            const colorOf = (needle: string): string => {
                const spans = [...document.querySelectorAll("#editor .view-line span")];
                const span = spans.find((entry) => fold(entry.textContent) === needle);
                return span ? getComputedStyle(span).color : "";
            };
            const key = colorOf("title");
            const value = colorOf("Notes");
            const flag = colorOf("false");
            if (!key || !value || !flag || key === value || key === flag) {
                return null;
            }
            return { key, value, flag };
        });
        expect(await colors.jsonValue()).toMatchObject({
            key: expect.any(String),
            value: expect.any(String),
            flag: expect.any(String),
        });
    });

    it("paints the darker code-block background and a yaml label in the top right", async () => {
        const block = await page.evaluate(() => {
            const fold = (value: string | null) => (value ?? "").replaceAll("\u00a0", " ");
            const root = document.querySelector(".inline-md-root");
            const lines = [...document.querySelectorAll("#editor .view-line")];
            const titleLine = lines.find((line) => fold(line.textContent).includes("title:"));
            const opener = lines[0];
            if (!(root instanceof HTMLElement) || !titleLine || !opener) {
                return { backgroundMatchesCode: false, lang: "", langAtTopRight: false };
            }
            const probe = document.createElement("span");
            probe.style.backgroundColor = getComputedStyle(root)
                .getPropertyValue("--ib-md-code-block-background")
                .trim();
            document.body.append(probe);
            const codeBackground = getComputedStyle(probe).backgroundColor;
            probe.remove();
            const titleBox = titleLine.getBoundingClientRect();
            const painted = [...document.querySelectorAll("#editor .inline-md-code-line")].some(
                (entry) => {
                    const box = entry.getBoundingClientRect();
                    return (
                        box.top <= titleBox.top + 2 &&
                        box.bottom >= titleBox.bottom - 2 &&
                        getComputedStyle(entry).backgroundColor === codeBackground
                    );
                },
            );
            const label = [...document.querySelectorAll("#editor .inline-md-lang")].find(
                (entry) => fold(entry.textContent).trim() === "yaml",
            );
            const labelBox = label?.getBoundingClientRect();
            const openerBox = opener.getBoundingClientRect();
            const gap = labelBox ? openerBox.right - labelBox.right : -1;
            const langAtTopRight =
                !!labelBox &&
                labelBox.width > 0 &&
                labelBox.height > 0 &&
                Math.abs(labelBox.top - openerBox.top) <= 4 &&
                gap >= 8 &&
                gap <= 24 &&
                labelBox.left > openerBox.left + openerBox.width / 2;
            return {
                backgroundMatchesCode: painted,
                lang: label ? fold(label.textContent).trim() : "",
                langAtTopRight,
            };
        });
        expect(block.backgroundMatchesCode).toBe(true);
        expect(block.lang).toBe("yaml");
        expect(block.langAtTopRight).toBe(true);
    });

    it("does not offer skill properties or show a skill error", async () => {
        expect(await page.locator(".inline-md-skill-error-message").count()).toBe(0);
        await page.evaluate(() => {
            const api = (
                window as unknown as {
                    __inlineMarkdown: {
                        focus(): void;
                        getDocument(): string;
                        setCursor(offset: number): void;
                    };
                }
            ).__inlineMarkdown;
            const source = api.getDocument();
            const at = source.indexOf("draft: false");
            api.focus();
            api.setCursor(at + "draft: false".length);
        });
        await page.keyboard.press("Enter");
        await page.keyboard.type("n");
        await page.waitForFunction(() => {
            const text = (
                document.querySelector("#editor .view-lines")?.textContent ?? ""
            ).replaceAll("\u00a0", " ");
            return text.includes("draft: false") && text.includes("n");
        });
        expect(await page.locator(".suggest-widget.visible").count()).toBe(0);
        expect(await page.locator(".inline-md-skill-error-message").count()).toBe(0);
    });
});
