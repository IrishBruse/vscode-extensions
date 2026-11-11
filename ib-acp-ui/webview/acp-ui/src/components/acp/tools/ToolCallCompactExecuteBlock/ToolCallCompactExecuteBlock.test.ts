import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vite-plus/test";
import type { TraceToolItem } from "../../../../chatReducer";
import { ToolCallCompactExecuteBlock } from "./ToolCallCompactExecuteBlock";

async function renderBlock(item: TraceToolItem, expandAllToolOutputs = false): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(ToolCallCompactExecuteBlock, {
      item,
      expandAllToolOutputs,
      onCollapseExpandAll: () => undefined,
    }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function executeItem(content: string, subtitle: string): TraceToolItem {
  return {
    type: "tool",
    toolCallId: "run-1",
    title: "Terminal",
    kind: "execute",
    subtitle,
    status: "completed",
    content,
    diffRows: undefined,
    detailVisible: true,
    durationMs: 2100,
  };
}

describe("ToolCallCompactExecuteBlock", () => {
  it("keeps a long command result behind Show output", async () => {
    const lines = Array.from({ length: 8 }, (_, index) => `line ${index + 1}`);
    const html = await renderBlock(executeItem(lines.join("\n"), "git status"));
    expect(html).toContain("Show output");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("ctrl+o");
    expect(html).not.toContain("output lines hidden");
    expect(html).not.toContain("line 1");
  });

  it("shows a short result in the output block", async () => {
    const html = await renderBlock(executeItem("On branch main", "git status"));
    expect(html).toContain('aria-label="Command output"');
    expect(html).toContain("On branch main");
    expect(html).not.toContain("Show output");
  });

  it("shows a live Running timer while the command is in progress", async () => {
    const html = await renderBlock({
      ...executeItem("building…", "npm run build:webview"),
      status: "in_progress",
      durationMs: undefined,
      startedAtMs: Date.now() - 3_800,
    });
    expect(html).toMatch(/Running for \d+\.\ds/);
    expect(html).not.toContain("Running…");
  });

  it("shows the full result when output is open", async () => {
    const lines = Array.from({ length: 8 }, (_, index) => `line ${index + 1}`);
    const html = await renderBlock(executeItem(lines.join("\n"), "git status"), true);
    expect(html).toContain("Hide output");
    expect(html).toContain('aria-label="Command output"');
    expect(html).toContain("line 1");
    expect(html).toContain("line 8");
  });
});
