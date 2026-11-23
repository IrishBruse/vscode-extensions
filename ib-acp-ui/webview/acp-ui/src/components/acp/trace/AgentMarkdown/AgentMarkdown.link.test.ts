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

describe("AgentMarkdown links", () => {
  it("shows the link target on the anchor", async () => {
    const html = await renderMarkdown(
      "[Finish or revert Bowser heal](178ce18c-356c-4b79-90fe-ec7bc776c7ea)",
    );
    expect(html).toContain('href="178ce18c-356c-4b79-90fe-ec7bc776c7ea"');
    expect(html).toContain('title="178ce18c-356c-4b79-90fe-ec7bc776c7ea"');
    expect(html).toContain("Finish or revert Bowser heal");
  });
});
