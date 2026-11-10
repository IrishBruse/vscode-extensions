import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vite-plus/test";
import { AgentThoughtBlock } from "./AgentThoughtBlock";

async function renderThought(
  text: string,
  props: { durationMs?: number; startedAtMs?: number } = { durationMs: 1_200 },
): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(AgentThoughtBlock, { text, ...props }),
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

  it("shows the body on the three-line preview until it is opened", async () => {
    const html = await renderThought("Done.");
    expect(html).toContain("agent-thought-chunk-body");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("agent-thought-chunk--open");
  });

  it("says Thinking while the thought is running and Thought once it finishes", async () => {
    const running = await renderThought("Still going.", { startedAtMs: Date.now() - 5_700 });
    expect(running).toContain("Thinking for");
    expect(running).not.toContain("Thought");

    const done = await renderThought("Done.");
    expect(done).toContain("Thought for 1.2s");
    expect(done).not.toContain("Thinking");
  });
});
