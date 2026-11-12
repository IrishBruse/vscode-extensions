import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vite-plus/test";
import { CursorCreatePlanDialog } from "./CursorCreatePlanDialog";

const plan = [
  "## Check",
  "",
  "- Update the AgentThoughtBlock stories with a long thought so the tail is visible.",
  "- Keep the existing markdown render test.",
  "- Add a changelog **Change** bullet under Unreleased.",
].join("\n");

async function renderPlan(): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(CursorCreatePlanDialog, {
      request: {
        type: "cursorCreatePlanRequest",
        requestId: "plan-1",
        name: "Thought block redesign",
        overview: "Keep the thought disclosure and clip the open body.",
        plan,
        todos: [],
      },
      onAccept: () => undefined,
      onReject: () => undefined,
      onCancel: () => undefined,
      onOpenPlan: () => undefined,
    }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("CursorCreatePlanDialog", () => {
  it("renders the plan as markdown and keeps Accept, Reject, and Cancel", async () => {
    const html = await renderPlan();

    expect(html).toContain("<h2>Check</h2>");
    expect(html).toContain("<li>Update the AgentThoughtBlock stories");
    expect(html).toContain("<strong>Change</strong>");
    expect(html).not.toContain("## Check");
    expect(html).not.toContain("**Change**");
    expect(html).toContain("Open plan");
    expect(html).toContain("Accept");
    expect(html).toContain("Reject");
    expect(html).toContain("Cancel");
  });
});
