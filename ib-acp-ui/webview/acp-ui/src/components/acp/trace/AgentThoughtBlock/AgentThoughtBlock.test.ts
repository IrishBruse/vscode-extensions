import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("AgentThoughtBlock", () => {
  it("mutes the header and clips the body to a three-line scroller", () => {
    const css = readFileSync(new URL("./AgentThoughtBlock.css", import.meta.url), "utf8");
    const title = css.match(/\.agent-thought-chunk-title\s*\{[^}]*\}/)?.[0] ?? "";
    expect(title).toContain("--acp-ui-font-weight-regular");
    expect(title).toContain("--vscode-descriptionForeground");
    const body = css.match(/\.agent-thought-chunk-body\s*\{[^}]*\}/)?.[0] ?? "";
    expect(body).toContain("max-height: 3lh");
    expect(body).toContain("overflow-y: auto");
    expect(body).toContain("--acp-ui-font-size-small");
    expect(body).toContain("--vscode-descriptionForeground");
  });

  it("pins the body to the latest text when the text changes", () => {
    const source = readFileSync(new URL("./AgentThoughtBlock.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/scrollTop\s*=\s*[^;\n]*scrollHeight/);
  });
});
