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

  it("renders the preview as markdown and keeps an open code fence", async () => {
    const filler = `${"x".repeat(2100)}\n`;
    const activity: TraceItem[] = [
      {
        type: "agent",
        text: `${filler}\`\`\`python\nprint(1)\nprint(2)\n\`\`\`\nDone **now**`,
      },
    ];
    const preview = activityPreview(activity);
    expect(preview.startsWith("```python")).toBe(true);
    expect(preview).toContain("**now**");
    expect(preview).not.toContain(filler.trim());
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
    expect(html).toContain("<strong>now</strong>");
    expect(html).toContain("print(1)");
    expect(html).not.toContain("agent-markdown-code-block-copy");
  });
});
