import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("Button", () => {
  it("copies the ACP UI permission button", () => {
    const css = readFileSync(new URL("./Button.css", import.meta.url), "utf8");
    expect(css).toContain(".vs-button");
    expect(css).toContain("--vscode-button-background");
    expect(css).toContain("--vscode-button-foreground");
    expect(css).toContain("--vscode-button-hoverBackground");
    expect(css).toContain(".vs-button--secondary");
    expect(css).toContain("padding: 4px 8px");
  });
});
