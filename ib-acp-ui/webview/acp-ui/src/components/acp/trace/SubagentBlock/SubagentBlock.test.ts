import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vite-plus/test";
import type { TraceItem, TraceToolItem } from "../../../../chatReducer";
import { activityPreview, SubagentBlock } from "./SubagentBlock";

async function renderBlock(item: TraceToolItem, activity?: readonly TraceItem[]): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(SubagentBlock, {
      tool: item,
      ...(activity !== undefined ? { activity } : {}),
    }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("SubagentBlock", () => {
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
    expect(html).not.toContain("Open</button>");
    expect(html).toContain("Explore");
  });

  it("keeps the latest six activity lines in one fixed preview", async () => {
    const activity: TraceItem[] = [
      { type: "agent", text: "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight" },
      { type: "tool", title: "Read auth.ts", kind: "read", subtitle: undefined, toolCallId: "read-1", status: "completed", content: undefined, diffRows: undefined, detailVisible: false },
    ];
    expect(activityPreview(activity)).toBe("four\nfive\nsix\nseven\neight\nRead auth.ts");
    const html = await renderBlock(
      {
        type: "tool",
        toolCallId: "task-1",
        title: "Task: Explore",
        kind: "other",
        subtitle: "explore",
        status: "in_progress",
        content: "Find the bug",
        diffRows: undefined,
        detailVisible: true,
        startedAtMs: Date.now(),
      },
      activity,
    );
    expect(html).toContain("subagent-block-activity");
    expect(html).toContain("Read auth.ts");
    expect(html).not.toContain(">one");
  });
});
