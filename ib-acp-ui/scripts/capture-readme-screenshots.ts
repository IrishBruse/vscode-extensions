/**
 * Capture README screenshots from Storybook scenario stories.
 *
 * Usage: npm run screenshots
 */

import { type ChildProcess, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "docs");

type CaptureSpec = {
    filename: string;
    storyId: string;
    composerOnly?: boolean;
};

const captures: CaptureSpec[] = [
    { storyId: "scenarios--showcase", filename: "Fullscreen.png" },
    { storyId: "scenarios--markdown", filename: "Markdown.png" },
    { storyId: "scenarios--tools", filename: "Tool-call.png" },
    { storyId: "scenarios--plan", filename: "Plan.png" },
    { storyId: "scenarios--cursor-model", filename: "Model-picker-cursor.png", composerOnly: true },
    { storyId: "scenarios--opus-model", filename: "Model-picker-opus.png", composerOnly: true },
];

async function reservePort(): Promise<number> {
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

type RunningProcess = {
    name: string;
    child: ChildProcess;
};

async function waitForUrl(url: string, timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url);
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

function startProcess(
    name: string,
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv,
): RunningProcess {
    const child = spawn(command, args, {
        cwd: root,
        env,
        stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (chunk: Buffer) => {
        process.stdout.write(`[${name}] ${chunk.toString()}`);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
        process.stderr.write(`[${name}] ${chunk.toString()}`);
    });
    return { name, child };
}

async function stopProcesses(processes: RunningProcess[]): Promise<void> {
    await Promise.all(
        processes.map(
            (entry) =>
                new Promise<void>((resolve) => {
                    if (entry.child.killed || entry.child.exitCode !== null) {
                        resolve();
                        return;
                    }
                    entry.child.once("exit", () => resolve());
                    entry.child.kill("SIGTERM");
                    setTimeout(() => {
                        if (!entry.child.killed) {
                            entry.child.kill("SIGKILL");
                        }
                    }, 2_000);
                }),
        ),
    );
}

async function waitForComposer(page: Page, requireTrace: boolean): Promise<void> {
    await page.waitForSelector(".composer-frame", { timeout: 30_000 });
    await page.waitForSelector(".composer-footer-model", { timeout: 30_000 });
    if (requireTrace) {
        await page.waitForSelector(".user-prompt-bar", { timeout: 30_000 });
    }
    await page.waitForTimeout(400);
}

async function captureSpec(page: Page, baseUrl: string, capture: CaptureSpec): Promise<void> {
    const url = `${baseUrl}/iframe.html?id=${capture.storyId}&viewMode=story`;
    await page.goto(url, { waitUntil: "networkidle" });
    await waitForComposer(page, capture.composerOnly !== true);
    if (capture.composerOnly === true) {
        await page.locator(".composer-footer").screenshot({
            path: join(docsDir, capture.filename),
        });
    } else {
        await page.screenshot({
            path: join(docsDir, capture.filename),
            fullPage: false,
        });
    }
    console.log(`Captured ${capture.filename}`);
}

async function main(): Promise<void> {
    await mkdir(docsDir, { recursive: true });
    const port = await reservePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const storybook = startProcess(
        "storybook",
        "npm",
        ["run", "storybook", "--", "--port", String(port), "--ci"],
        process.env,
    );
    const browser = await chromium.launch();
    try {
        await waitForUrl(`${baseUrl}/iframe.html`);
        const page = await browser.newPage({
            viewport: { width: 1280, height: 900 },
            deviceScaleFactor: 2,
        });
        try {
            for (const capture of captures) {
                await captureSpec(page, baseUrl, capture);
            }
        } finally {
            await page.close();
        }
        console.log(`Wrote screenshots under ${docsDir}`);
    } finally {
        await browser.close();
        await stopProcesses([storybook]);
    }
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exit(1);
});
