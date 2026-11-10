import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("ToolCallCompactBlock path links", () => {
  it("uses the link color for file paths and the link hover color on hover", () => {
    const css = readFileSync(new URL("./ToolCallCompactBlock.css", import.meta.url), "utf8");
    const rules = css.match(/[^{}]*tool-call-compact-path-link[^{]*\{[^}]*\}/g) ?? [];
    const hover = rules.filter((rule) => rule.includes(":hover") || rule.includes(":focus-visible"));
    const rest = rules.filter((rule) => !hover.includes(rule));
    const colorOf = (rule: string): string => rule.match(/color:\s*([^;]+);/)?.[1]?.trim() ?? "";
    expect(rest.length).toBeGreaterThan(0);
    expect(hover.length).toBeGreaterThan(0);
    for (const color of rest.map(colorOf)) {
      expect(color).toContain("--vscode-textLink-foreground");
      expect(color).not.toContain("--vscode-textLink-activeForeground");
    }
    for (const color of hover.map(colorOf)) {
      expect(color).toContain("--vscode-textLink-activeForeground");
    }
  });
});
