import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vite-plus/test";
import { AgentThoughtBlock } from "./AgentThoughtBlock";

async function renderThought(text: string): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(AgentThoughtBlock, { text, durationMs: 1_200 }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("AgentThoughtBlock markdown", () => {
  it("renders thought text as markdown", async () => {
    const html = await renderThought(
      "Check `sessionReducer` first.\n\n## Next steps\n\n- Read the trace\n- Align tests",
    );

    expect(html).toContain("<code>sessionReducer</code>");
    expect(html).toContain("<h2>Next steps</h2>");
    expect(html).toContain("<li>Read the trace</li>");
    expect(html).not.toContain("<pre");
  });
});
