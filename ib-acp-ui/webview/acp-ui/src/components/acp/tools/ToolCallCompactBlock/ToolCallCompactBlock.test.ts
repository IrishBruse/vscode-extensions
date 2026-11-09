import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("ToolCallCompactBlock path links", () => {
  it("uses the link color for file names", () => {
    const css = readFileSync(new URL("./ToolCallCompactBlock.css", import.meta.url), "utf8");
    const rules = css.match(/[^{}]*tool-call-compact-path-link[^{]*\{[^}]*\}/g) ?? [];
    const colors = rules
      .map((rule) => rule.match(/color:\s*([^;]+);/)?.[1]?.trim())
      .filter((color): color is string => color !== undefined);
    expect(colors.length).toBeGreaterThan(0);
    for (const color of colors) {
      expect(color).toContain("--vscode-textLink-foreground");
      expect(color).not.toContain("--vscode-terminal-ansiGreen");
    }
  });
});
