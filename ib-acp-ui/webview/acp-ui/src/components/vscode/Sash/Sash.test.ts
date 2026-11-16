import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("Sash", () => {
  it("matches the workbench sash treatment", () => {
    const css = readFileSync(new URL("./Sash.css", import.meta.url), "utf8");
    expect(css).toContain(".vs-sash--vertical");
    expect(css).toContain("--acp-ui-sash-idle-border");
    expect(css).toContain("--acp-ui-sash-hover-border");
    expect(css).not.toContain("--vscode-focusBorder");
    expect(css).toContain("cursor: ew-resize");
  });
});