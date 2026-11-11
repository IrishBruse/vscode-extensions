import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("AgentMarkdown quotes", () => {
  it("uses the markdown preview quote bar", () => {
    const css = readFileSync(new URL("./AgentMarkdown.css", import.meta.url), "utf8");
    const rule = css.match(/\.agent-markdown blockquote\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("padding: 0 16px 0 10px");
    expect(rule).toContain("border-left: 5px solid");
    expect(rule).toContain("background-color: transparent");
    expect(rule).not.toContain("--vscode-textBlockQuote-background");
    expect(rule).toContain("--vscode-textBlockQuote-border");
    expect(rule).toContain("border-radius: 2px");
  });
});
