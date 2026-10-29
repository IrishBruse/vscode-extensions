import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { expectLocatorShot, openPlayground } from "../../../../test/support/browser";
import type { Browser, Page } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));

const fixture = "markdown/fence/mermaid/test/fixtures/case-1.md";

describe("mermaid open preview", () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
        const opened = await openPlayground(fixture, "Before the fence.");
        browser = opened.browser;
        page = opened.page;
        await page.evaluate(() => {
            const api = (
                window as unknown as {
                    __inlineMarkdown: { getDocument(): string; setCursor(offset: number): void };
                }
            ).__inlineMarkdown;
            api.setCursor(api.getDocument().indexOf("Before"));
        });
        await page.waitForFunction(() => {
            const frame = document.querySelector(".inline-md-mermaid");
            const button = frame?.querySelector(".inline-md-mermaid-open-preview");
            const svg = frame?.querySelector(".inline-md-mermaid-diagram svg");
            if (
                !(frame instanceof HTMLElement) ||
                !(button instanceof HTMLElement) ||
                !(svg instanceof SVGElement)
            ) {
                return false;
            }
            const frameBox = frame.getBoundingClientRect();
            const buttonBox = button.getBoundingClientRect();
            const svgBox = svg.getBoundingClientRect();
            return (
                buttonBox.height > 0 &&
                svgBox.height > 20 &&
                buttonBox.top >= frameBox.top - 1 &&
                buttonBox.right <= frameBox.right + 1 &&
                frameBox.right - buttonBox.right <= 24 &&
                buttonBox.top - frameBox.top <= 12 &&
                svgBox.bottom <= frameBox.bottom + 1
            );
        });
    }, 45_000);

    afterAll(async () => {
        await browser?.close();
    });

    it("keeps diagram nodes free of neo drop shadows", async () => {
        const shadow = await page.evaluate(() => {
            const root = document.querySelector(".inline-md-mermaid-diagram");
            if (!(root instanceof HTMLElement)) {
                return null;
            }
            const neo = root.querySelectorAll('.node[data-look="neo"]').length;
            const filtered = [...root.querySelectorAll("rect, polygon, circle, path")].filter(
                (node) => {
                    if (!(node instanceof SVGElement)) {
                        return false;
                    }
                    const filter = getComputedStyle(node).filter;
                    return filter !== "none" && filter.includes("drop-shadow");
                },
            ).length;
            return { neo, filtered };
        });
        expect(shadow).not.toBeNull();
        expect(shadow!.neo).toBe(0);
        expect(shadow!.filtered).toBe(0);
    });

    it("floats Open Preview in the top right of the code block", async () => {
        const boxes = await page.evaluate(() => {
            const frame = document.querySelector(".inline-md-mermaid");
            const button = frame?.querySelector(".inline-md-mermaid-open-preview");
            const svg = frame?.querySelector(".inline-md-mermaid-diagram svg");
            if (
                !(frame instanceof HTMLElement) ||
                !(button instanceof HTMLElement) ||
                !(svg instanceof SVGElement)
            ) {
                return null;
            }
            const frameBox = frame.getBoundingClientRect();
            const buttonBox = button.getBoundingClientRect();
            const svgBox = svg.getBoundingClientRect();
            const lensOverlap = [...document.querySelectorAll(".codelens-decoration")].some(
                (node) => {
                    if (
                        !(node instanceof HTMLElement) ||
                        !node.textContent?.includes("Open Preview")
                    ) {
                        return false;
                    }
                    const lens = node.getBoundingClientRect();
                    return (
                        lens.width > 0 &&
                        lens.height > 0 &&
                        lens.bottom > svgBox.top &&
                        lens.top < svgBox.bottom
                    );
                },
            );
            return {
                rightGap: frameBox.right - buttonBox.right,
                topGap: buttonBox.top - frameBox.top,
                svgBottom: svgBox.bottom,
                frameBottom: frameBox.bottom,
                lensOverlap,
            };
        });
        expect(boxes).not.toBeNull();
        expect(boxes!.rightGap).toBeLessThanOrEqual(24);
        expect(boxes!.topGap).toBeLessThanOrEqual(12);
        expect(boxes!.svgBottom).toBeLessThanOrEqual(boxes!.frameBottom + 1);
        expect(boxes!.lensOverlap).toBe(false);
    });

    it("lines the diagram up with the code block", async () => {
        const edges = await page.evaluate(() => {
            const fold = (value: string | null) => (value ?? "").replaceAll("\u00a0", " ");
            const code = [...document.querySelectorAll("#editor .view-line")].find((line) =>
                fold(line.textContent).includes("const value"),
            );
            const text = code
                ? [...code.querySelectorAll("span")].find((node) =>
                      fold(node.textContent).includes("const"),
                  )
                : undefined;
            const frame = document.querySelector(".inline-md-mermaid");
            const svg = frame?.querySelector(".inline-md-mermaid-diagram svg");
            if (
                !(code instanceof HTMLElement) ||
                !(text instanceof HTMLElement) ||
                !(frame instanceof HTMLElement) ||
                !(svg instanceof SVGElement)
            ) {
                return null;
            }
            return {
                codeLeft: code.getBoundingClientRect().left,
                textLeft: text.getBoundingClientRect().left,
                frameLeft: frame.getBoundingClientRect().left,
                svgLeft: svg.getBoundingClientRect().left,
            };
        });
        expect(edges).not.toBeNull();
        expect(Math.abs(edges!.frameLeft - edges!.codeLeft)).toBeLessThanOrEqual(1);
        expect(Math.abs(edges!.svgLeft - edges!.textLeft)).toBeLessThanOrEqual(1);
    });

    it("shows Open Preview in the top right of the code block", async () => {
        await expectLocatorShot(
            page.locator(".inline-md-mermaid"),
            join(here, "screenshots", "mermaid.png"),
        );
    });

    it("keeps Open Preview in the top right while editing the fence", async () => {
        await page.evaluate(() => {
            const api = (
                window as unknown as {
                    __inlineMarkdown: { getDocument(): string; setCursor(offset: number): void };
                }
            ).__inlineMarkdown;
            api.setCursor(api.getDocument().indexOf("flowchart"));
        });
        await page.waitForFunction(() => {
            const button = document.querySelector(".inline-md-mermaid-open-preview-lens");
            const codeLine = [...document.querySelectorAll("#editor .view-line")].find((line) =>
                (line.textContent ?? "").includes("```mermaid"),
            );
            if (!(button instanceof HTMLElement) || !(codeLine instanceof HTMLElement)) {
                return false;
            }
            const buttonBox = button.getBoundingClientRect();
            const lineBox = codeLine.getBoundingClientRect();
            return (
                buttonBox.height > 0 &&
                Math.abs(buttonBox.top - lineBox.top) <= 4 &&
                lineBox.right - buttonBox.right <= 24
            );
        });
        const boxes = await page.evaluate(() => {
            const button = document.querySelector(".inline-md-mermaid-open-preview-lens");
            const codeLine = [...document.querySelectorAll("#editor .view-line")].find((line) =>
                (line.textContent ?? "").includes("```mermaid"),
            );
            const lens = [...document.querySelectorAll(".codelens-decoration")].find((node) =>
                node.textContent?.includes("Open Preview"),
            );
            if (!(button instanceof HTMLElement) || !(codeLine instanceof HTMLElement)) {
                return null;
            }
            const buttonBox = button.getBoundingClientRect();
            const lineBox = codeLine.getBoundingClientRect();
            const lensBox =
                lens instanceof HTMLElement ? lens.getBoundingClientRect() : { height: 0 };
            return {
                topGap: Math.abs(buttonBox.top - lineBox.top),
                rightGap: lineBox.right - buttonBox.right,
                lensHeight: lensBox.height,
            };
        });
        expect(boxes).not.toBeNull();
        expect(boxes!.topGap).toBeLessThanOrEqual(4);
        expect(boxes!.rightGap).toBeLessThanOrEqual(24);
        expect(boxes!.lensHeight).toBe(0);
        await page.evaluate(() => {
            const api = (
                window as unknown as {
                    __inlineMarkdown: { getDocument(): string; setCursor(offset: number): void };
                }
            ).__inlineMarkdown;
            api.setCursor(api.getDocument().indexOf("Before"));
        });
    });
});

const tallFixture = "markdown/fence/mermaid/test/fixtures/case-2.md";

describe("mermaid fits source height", () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
        const opened = await openPlayground(tallFixture, "Before the tall fence.");
        browser = opened.browser;
        page = opened.page;
        await page.evaluate(() => {
            const api = (
                window as unknown as {
                    __inlineMarkdown: { getDocument(): string; setCursor(offset: number): void };
                }
            ).__inlineMarkdown;
            api.setCursor(api.getDocument().indexOf("Before the tall"));
        });
        await page.waitForFunction(() => {
            const frame = document.querySelector(".inline-md-mermaid");
            const svg = frame?.querySelector(".inline-md-mermaid-diagram svg");
            return (
                frame instanceof HTMLElement &&
                svg instanceof SVGElement &&
                svg.getBoundingClientRect().height > 20
            );
        });
    }, 45_000);

    afterAll(async () => {
        await browser?.close();
    });

    it("keeps the preview within the source fence height", async () => {
        const sizes = await page.evaluate(() => {
            const fold = (value: string | null) => (value ?? "").replaceAll("\u00a0", " ");
            const api = (
                window as unknown as {
                    __inlineMarkdown: { getDocument(): string };
                }
            ).__inlineMarkdown;
            const source = api.getDocument();
            const fenceStart = source.indexOf("```mermaid");
            const fenceEnd = source.indexOf("```", fenceStart + 3);
            const fenceText = source.slice(fenceStart, fenceEnd + 3);
            const fenceLines = fenceText.split(/\r?\n/).length;
            const before = [...document.querySelectorAll("#editor .view-line")].find((line) =>
                fold(line.textContent).includes("Before the tall"),
            );
            const after = [...document.querySelectorAll("#editor .view-line")].find((line) =>
                fold(line.textContent).includes("After the tall"),
            );
            const frame = document.querySelector(".inline-md-mermaid");
            const svg = frame?.querySelector(".inline-md-mermaid-diagram svg");
            if (
                !(before instanceof HTMLElement) ||
                !(after instanceof HTMLElement) ||
                !(frame instanceof HTMLElement) ||
                !(svg instanceof SVGElement)
            ) {
                return null;
            }
            const lineHeight = before.getBoundingClientRect().height;
            const frameBox = frame.getBoundingClientRect();
            const beforeBox = before.getBoundingClientRect();
            const afterBox = after.getBoundingClientRect();
            const svgBox = svg.getBoundingClientRect();
            return {
                fenceLines,
                lineHeight,
                sourceHeight: fenceLines * lineHeight,
                frameHeight: frameBox.height,
                frameTop: frameBox.top,
                beforeBottom: beforeBox.bottom,
                afterTop: afterBox.top,
                svgTop: svgBox.top,
                svgBottom: svgBox.bottom,
                svgHeight: svgBox.height,
                frameBottom: frameBox.bottom,
            };
        });
        expect(sizes).not.toBeNull();
        expect(Math.abs(sizes!.frameHeight - sizes!.sourceHeight)).toBeLessThanOrEqual(1);
        expect(sizes!.frameTop).toBeGreaterThanOrEqual(sizes!.beforeBottom - 1);
        expect(sizes!.svgTop).toBeGreaterThanOrEqual(sizes!.frameTop - 1);
        expect(sizes!.svgBottom).toBeLessThanOrEqual(sizes!.frameBottom + 1);
        expect(sizes!.svgHeight).toBeGreaterThan(20);
        expect(sizes!.afterTop).toBeGreaterThanOrEqual(sizes!.frameBottom - 1);
    });

    it("shows a line number in the gutter for each fence line", async () => {
        const numbers = await page.evaluate(() => {
            const api = (
                window as unknown as {
                    __inlineMarkdown: { getDocument(): string };
                }
            ).__inlineMarkdown;
            const source = api.getDocument();
            const fenceStart = source.indexOf("```mermaid");
            const fenceEnd = source.indexOf("```", fenceStart + 3);
            const fenceText = source.slice(fenceStart, fenceEnd + 3);
            const firstLine = source.slice(0, fenceStart).split(/\r?\n/).length;
            const fenceLines = fenceText.split(/\r?\n/).length;
            const zoneNumbers = [
                ...document.querySelectorAll(".inline-md-fence-margin .inline-md-zone-number"),
            ].map((node) => Number((node.textContent ?? "").trim()));
            return { firstLine, fenceLines, zoneNumbers };
        });
        expect(numbers.zoneNumbers.length).toBe(numbers.fenceLines);
        expect(numbers.zoneNumbers[0]).toBe(numbers.firstLine);
        for (let index = 1; index < numbers.zoneNumbers.length; index += 1) {
            expect(numbers.zoneNumbers[index]).toBe(numbers.zoneNumbers[index - 1] + 1);
        }
    });
});
