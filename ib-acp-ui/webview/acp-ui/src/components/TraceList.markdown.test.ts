import { createElement, createRef } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vite-plus/test";
import { TraceList } from "./TraceList";

async function renderTrace(text: string, imageCount?: number): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(TraceList, {
      items: [{ type: "user", text, imageCount }],
      showThoughts: false,
      expandAllToolOutputs: false,
      toolCallVerbosity: "verbose",
      followBottom: true,
      historyCommit: 0,
      traceScrollRef: createRef<HTMLElement>(),
    }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("TraceList user markdown", () => {
  it("renders user message headings and paragraphs", async () => {
    const html = await renderTrace(
      "# Pause menu Settings handoff\n\nThe in-level pause menu row stays visible.\n\n## What is already true on screen",
    );

    expect(html).toContain("<h1>Pause menu Settings handoff</h1>");
    expect(html).toContain("<h2>What is already true on screen</h2>");
    expect(html).toContain("<p>The in-level pause menu row stays visible.</p>");
    expect(html).not.toContain("# Pause menu");
    expect(html).toContain('aria-label="User message"');
  });

  it("keeps the image count beside a markdown user message", async () => {
    const html = await renderTrace("`vendor/decomp` is a submodule.", 2);

    expect(html).toContain("2 images");
    expect(html).toContain("<code>vendor/decomp</code>");
  });
});
