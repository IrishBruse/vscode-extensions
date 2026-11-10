import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("ChatComposer", () => {
  it("shows the workspace path and does not pulse an activity label", () => {
    const tsx = readFileSync(new URL("./ChatComposer.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./ChatComposer.css", import.meta.url), "utf8");
    expect(tsx).toContain("{workspacePathHint}");
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
    expect(tsx).toContain("composer-top-bar-status--live");
    expect(tsx).toContain("ACP disconnected");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)");
    expect(css).toContain("composer-status-pulse");
    const status = css.match(/\.composer-top-bar-status\s*\{[^}]*\}/)?.[0] ?? "";
    expect(status).not.toContain("text-overflow");
  });

  it("paints the composer frame with the input border", () => {
    const css = readFileSync(new URL("./ChatComposer.css", import.meta.url), "utf8");
    const start = css.indexOf(".composer-frame {");
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).toContain("--vscode-settings-textInputBorder");
    expect(rule).toContain("--vscode-input-border");
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
