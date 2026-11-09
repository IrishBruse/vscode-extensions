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
  });

  it("paints the attached image border with the chrome border", () => {
    const css = readFileSync(new URL("./ChatComposer.css", import.meta.url), "utf8");
    const start = css.indexOf(".composer-image-thumb {");
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).toContain("border:");
    expect(rule).toContain("var(--acp-ui-border-chrome)");
    expect(rule).not.toContain("var(--vscode-focusBorder)");
  });
});
