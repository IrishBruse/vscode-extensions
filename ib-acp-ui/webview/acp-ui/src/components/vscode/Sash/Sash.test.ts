import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("Sash", () => {
  it("matches the workbench sash treatment", () => {
    const css = readFileSync(new URL("./Sash.css", import.meta.url), "utf8");
    expect(css).toContain(".vs-sash--vertical");
    expect(css).toContain("--vscode-panel-border");
    expect(css).toContain("--vscode-sash-hoverBorder");
    expect(css).toContain("cursor: ew-resize");
  });
});