/**
 * Capture README screenshots from the browser playground (no VS Code required).
 *
 * Usage: npm run screenshots
 * Requires Playwright Chromium once: npx playwright install chromium
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionRoot = join(scriptDir, "..");
const markdownInlineDir = join(extensionRoot, "src/markdownInline");
const docsDir = join(extensionRoot, "docs");

const require = createRequire(join(extensionRoot, "package.json"));
const vpBin = join(dirname(require.resolve("vite-plus/package.json")), "bin", "vp");

const HIDE_CHROME = `
#toolbar { display: none !important; }
.monaco-editor .cursors-layer,
.monaco-editor .current-line { opacity: 0 !important; }
`;

const captures = [
    {
        filename: "Overview.png",
        fixture: "readme-feature-tour.md",
        marker: "Inline Markdown preview",
    },
    {
        filename: "Editing-source.png",
        fixture: "playground.md",
        marker: "Hello",
        clickHeading: true,
    },
    {
        filename: "Tables.png",
        fixture: "markdown/table/test/fixtures/case-1.md",
        marker: "Keep the caret",
        waitTables: 3,
    },
    {
        filename: "Tasks.png",
        fixture: "markdown/list/task/test/fixtures/case-2.md",
        marker: "Tasks",
    },
    {
        filename: "Mermaid.png",
        fixture: "markdown/fence/mermaid/test/fixtures/case-1.md",
        marker: "Before the fence",
        waitMermaid: true,
    },
    {
        filename: "Skill-front-matter.png",
        fixture: "skill/test/fixtures/markdown-skill-fixture/SKILL.md",
        marker: "markdown-skill-fixture",
    },
];

async function reservePort() {
    return await new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (address === null || typeof address === "string") {
                server.close();
                reject(new Error("Failed to reserve an ephemeral port."));
                return;
            }
            const port = address.port;
            server.close((err) => {
                if (err !== undefined) {
                    reject(err);
                    return;
                }
                resolve(port);
            });
        });
        server.on("error", reject);
    });
}

async function waitForUrl(url, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
            if (response.ok) {
                return;
            }
        } catch {
            /* retry */
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Timed out waiting for ${url}`);
}

function stopVite(vite) {
    if (!vite || vite.exitCode !== null || vite.signalCode !== null || !vite.pid) {
        return;
    }
    try {
        process.kill(-vite.pid, "SIGTERM");
    } catch {
        try {
            vite.kill("SIGTERM");
        } catch {}
    }
}

function startVite(port) {
    const vite = spawn(
        vpBin,
        [
            "dev",
            "--config",
            "playground/vite.config.ts",
            "--host",
            "127.0.0.1",
            "--port",
            String(port),
            "--strictPort",
        ],
        {
            cwd: markdownInlineDir,
            stdio: "pipe",
            detached: true,
        },
    );
    let log = "";
    const append = (chunk) => {
        log = `${log}${chunk.toString()}`.slice(-20_000);
    };
    vite.stdout?.on("data", append);
    vite.stderr?.on("data", append);
    return { vite, log: () => log };
}

async function waitForEditor(page, marker) {
    await page.waitForFunction(
        (id) => {
            const overlay = document.querySelector("vite-error-overlay");
            const message = overlay?.shadowRoot?.textContent?.replace(/\s+/g, " ").trim();
            if (message) {
                throw new Error(message);
            }
            const text = (
                document.querySelector("#editor .view-lines")?.textContent ?? ""
            ).replaceAll("\u00a0", " ");
            return text.includes(id);
        },
        marker,
        { timeout: 30_000 },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: HIDE_CHROME });
    await page.waitForTimeout(200);
}

async function captureOne(browser, port, capture) {
    const baseUrl = `http://127.0.0.1:${port}`;
    const page = await browser.newPage({
        viewport: { width: 920, height: 720 },
        deviceScaleFactor: 2,
    });
    try {
        const url = `${baseUrl}/?fixture=${encodeURIComponent(capture.fixture)}`;
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await waitForEditor(page, capture.marker);
        if (capture.waitTables) {
            await page.waitForFunction(
                (count) => document.querySelectorAll(".inline-md-table table").length >= count,
                capture.waitTables,
            );
        }
        if (capture.waitMermaid) {
            await page.waitForFunction(
                () => document.querySelector(".inline-md-mermaid-diagram svg") !== null,
                undefined,
                { timeout: 30_000 },
            );
        }
        if (capture.clickHeading) {
            await page.locator(".inline-md-h1").click();
            await page.waitForFunction(() => {
                const text = document.querySelector("#editor .view-lines")?.textContent ?? "";
                return text.includes("#");
            });
        }
        await page.locator("#editor").screenshot({
            path: join(docsDir, capture.filename),
            animations: "disabled",
        });
        console.log(`Captured ${capture.filename}`);
    } finally {
        await page.close();
    }
}

async function main() {
    mkdirSync(docsDir, { recursive: true });
    const port = await reservePort();
    const server = startVite(port);
    const baseUrl = `http://127.0.0.1:${port}/`;
    const browser = await chromium.launch();
    try {
        await waitForUrl(baseUrl);
        if (server.vite.exitCode !== null) {
            throw new Error(`Vite exited before capture.\n${server.log()}`);
        }
        for (const capture of captures) {
            await captureOne(browser, port, capture);
        }
        console.log(`Wrote screenshots under ${docsDir}`);
    } finally {
        await browser.close();
        stopVite(server.vite);
    }
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
