import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("AgentThoughtBlock", () => {
  it("mutes the header and clips the body to three lines with no scrollbar", () => {
    const css = readFileSync(new URL("./AgentThoughtBlock.css", import.meta.url), "utf8");
    const title = css.match(/\.agent-thought-chunk-title\s*\{[^}]*\}/)?.[0] ?? "";
    expect(title).toContain("--acp-ui-font-weight-regular");
    expect(title).toContain("--vscode-descriptionForeground");
    const body = css.match(/\.agent-thought-chunk-body\s*\{[^}]*\}/)?.[0] ?? "";
    expect(body).toContain("height: 3lh");
    expect(body).toContain("justify-content: flex-end");
    expect(body).toContain("overflow: hidden");
    expect(body).not.toContain("overflow-y: auto");
    expect(body).toContain("--acp-ui-font-size-small");
    expect(body).toContain("--vscode-descriptionForeground");
    expect(css).toMatch(/\.agent-thought-chunk--open \.agent-thought-chunk-body\s*\{[^}]*height:\s*auto/);
  });

  it("starts on the three-line preview and opens to the full text", () => {
    const source = readFileSync(new URL("./AgentThoughtBlock.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/useState\(false\)/);
    expect(source).toContain("agent-thought-chunk--open");
  });
});
