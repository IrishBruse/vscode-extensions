import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vite-plus/test";
import { PlanBlock } from "./PlanBlock";

async function renderPlan(): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(PlanBlock, {
      entries: [
        { status: "pending", content: "Copy the first story save" },
        { status: "in_progress", content: "Diff the course fields" },
        { status: "completed", content: "Read the session controller" },
        { status: "cancelled", content: "Skip the unused pass" },
      ],
    }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("PlanBlock", () => {
  it("names the list TODO and marks each state", async () => {
    const html = await renderPlan();
    expect(html).toContain(">TODO<");
    expect(html).toContain('aria-label="Pending"');
    expect(html).toContain('aria-label="In progress"');
    expect(html).toContain('aria-label="Complete"');
    expect(html).toContain('aria-label="Cancelled"');
    expect(html).toContain("agent-plan-mark--pending");
    expect(html).toContain("agent-plan-mark--in_progress");
    expect(html).toContain("agent-plan-mark--completed");
    expect(html).toContain("agent-plan-mark--cancelled");
    expect(html).not.toContain(">pending<");
    expect(html).not.toContain(">PENDING<");
  });
});
