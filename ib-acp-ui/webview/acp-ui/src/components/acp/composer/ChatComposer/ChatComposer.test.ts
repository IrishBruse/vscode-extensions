import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { composerDisconnectStatusLine } from "./ChatComposer";

describe("composerDisconnectStatusLine", () => {
  it("shows only the first line of a multi-line disconnect message", () => {
    expect(
      composerDisconnectStatusLine(
        'Lost connection to ACP agent "Cursor".\nThe agent process exited with an error (code 1).\nSend a message to reconnect.',
      ),
    ).toBe('Lost connection to ACP agent "Cursor".');
  });
});

describe("ChatComposer", () => {
  it("shows the workspace path and does not pulse an activity label", () => {
    const tsx = readFileSync(new URL("./ChatComposer.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./ChatComposer.css", import.meta.url), "utf8");
    expect(tsx).toContain("{workspacePathHint}");
    expect(tsx).not.toContain("composerLocationLabel");
    expect(tsx).not.toContain("activityLabel");
    expect(tsx).not.toContain("composer-activity--inflight");
    expect(css).not.toContain("composer-activity-pulse");
    expect(css).not.toContain("composer-activity--inflight");
    const topBar = tsx.indexOf("composer-top-bar");
    expect(tsx.indexOf("composer-top-bar-status")).toBeGreaterThan(topBar);
    expect(tsx.indexOf("composer-top-bar-status")).toBeLessThan(tsx.indexOf("composer-top-bar-hint"));
    expect(tsx).toContain("Connecting to ACP");
    expect(tsx).not.toContain("Connecting to ACP…");
    expect(tsx).toContain("Thinking for");
    expect(tsx).toContain("Running for");
    expect(tsx).toContain("composer-top-bar-status--live");
    expect(tsx).toContain("ACP disconnected");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)");
    expect(css).toContain("composer-status-pulse");
    const status = css.match(/\.composer-top-bar-status\s*\{[^}]*\}/)?.[0] ?? "";
    expect(status).not.toContain("text-overflow");
  });

  it("shows context usage beside the model controls in the footer", () => {
    const tsx = readFileSync(new URL("./ChatComposer.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./ChatComposer.css", import.meta.url), "utf8");
    expect(tsx).toContain('aria-label="Context usage"');
    expect(tsx).not.toContain('role="meter"');
    expect(css).not.toContain(".composer-context-fill");
    expect(css).toContain(".composer-context");
    expect(css).toMatch(/\.composer-context\s*\{[^}]*align-self:\s*flex-end/);
    expect(css).toMatch(/\.composer-context\s*\{[^}]*min-height:\s*26px/);
    expect(css).toMatch(/\.composer-context\s*\{[^}]*font-size:\s*var\(--acp-ui-font-size-small\)/);
    expect(tsx).toContain("composer-footer-model");
    expect(tsx).toContain("<ContextUsageLabel usage={tokenUsage} />");
    const topEnd = tsx.indexOf('className="composer-top-bar-side composer-top-bar-side--end"');
    const topBarClose = tsx.indexOf("</div>", tsx.indexOf("composer-top-bar-hint", topEnd));
    expect(tsx.slice(topEnd, topBarClose)).not.toContain("<ContextUsageLabel");
  });

  it("paints the composer frame with the input border", () => {
    const css = readFileSync(new URL("./ChatComposer.css", import.meta.url), "utf8");
    const start = css.indexOf(".composer-frame {");
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).toContain("--vscode-settings-textInputBorder");
    expect(rule).toContain("--vscode-input-border");
  });

  it("shows compact thumbnails on queued follow-ups with images", () => {
    const tsx = readFileSync(new URL("./ChatComposer.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./ChatComposer.css", import.meta.url), "utf8");
    expect(tsx).toContain("composer-follow-up-thumb");
    expect(css).toContain(".composer-follow-up-thumb");
    expect(css).toMatch(/\.composer-follow-up-thumb[\s\S]*width:\s*1\.25rem/);
  });

  it("paints the attached image border with the input border", () => {
    const css = readFileSync(new URL("./ChatComposer.css", import.meta.url), "utf8");
    const start = css.indexOf(".composer-image-thumb {");
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).toContain("border:");
    expect(rule).toContain("--vscode-settings-textInputBorder");
    expect(rule).toContain("--vscode-input-border");
    expect(rule).not.toContain("var(--acp-ui-border-chrome)");
    expect(rule).not.toContain("var(--vscode-focusBorder)");
  });
});
