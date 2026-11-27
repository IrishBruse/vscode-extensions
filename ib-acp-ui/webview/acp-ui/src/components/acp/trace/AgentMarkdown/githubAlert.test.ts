import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vite-plus/test";
import { AgentMarkdown } from "./AgentMarkdown";

async function renderMarkdown(text: string): Promise<string> {
  const { prelude } = await prerenderToNodeStream(createElement(AgentMarkdown, { text }));
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("AgentMarkdown github alerts", () => {
  it("renders a NOTE quote as a titled note", async () => {
    const html = await renderMarkdown("> [!NOTE]\n> Keep the save file.");
    expect(html).toContain('data-alert="note"');
    expect(html).toContain("agent-markdown-alert-title");
    expect(html).toContain("Note");
    expect(html).toContain("Keep the save file.");
    expect(html).not.toContain("[!NOTE]");
  });

  it("leaves a normal quote as a blockquote", async () => {
    const html = await renderMarkdown("> Just a quote.");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("Just a quote.");
    expect(html).not.toContain("data-alert");
  });
});

describe("AgentMarkdown mermaid", () => {
  it("keeps mermaid source visible until the diagram renders", async () => {
    const html = await renderMarkdown("```mermaid\ngraph TD\n  A-->B\n```");
    expect(html).toContain("language-mermaid");
    expect(html).toContain("graph TD");
  });
});
