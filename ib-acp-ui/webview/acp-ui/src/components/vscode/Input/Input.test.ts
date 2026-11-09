import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("Input", () => {
  it("matches the settings text field in the picture", () => {
    const css = readFileSync(new URL("./Input.css", import.meta.url), "utf8");
    expect(css).toContain(".vs-input-control");
    expect(css).toContain("height: 26px");
    expect(css).toContain("--vscode-settings-textInputBackground");
    expect(css).toContain("--vscode-settings-textInputBorder");
    expect(css).toContain(".vs-input-modified");
    expect(css).toContain("--vscode-settings-modifiedItemIndicator");
    expect(css).toContain(".vs-input-description");
    expect(css).toContain("--vscode-descriptionForeground");
  });
});
