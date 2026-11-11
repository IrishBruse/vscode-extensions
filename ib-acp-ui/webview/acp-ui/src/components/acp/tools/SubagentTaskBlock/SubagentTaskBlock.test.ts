import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vite-plus/test";
import type { TraceToolItem } from "../../../../chatReducer";
import { SubagentTaskBlock } from "./SubagentTaskBlock";

async function renderBlock(item: TraceToolItem): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(SubagentTaskBlock, {
      item,
      expandAllToolOutputs: false,
      onCollapseExpandAll: () => undefined,
    }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("SubagentTaskBlock", () => {
  it("shows a live Running for timer while the task is running", async () => {
    const html = await renderBlock({
      type: "tool",
      toolCallId: "task-1",
      title: "Task: Explore",
      kind: "other",
      subtitle: "explore",
      status: "in_progress",
      content: "Find the bug",
      diffRows: undefined,
      detailVisible: true,
      startedAtMs: Date.now() - 2_400,
    });
    expect(html).toMatch(/Running for \d+\.\ds/);
  });
});
