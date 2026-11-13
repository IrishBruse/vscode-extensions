import { readFileSync } from "node:fs";
import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it } from "vite-plus/test";
import type { TraceToolItem } from "../../../../chatReducer";
import { ToolCallCompactBlock } from "./ToolCallCompactBlock";

async function renderBlock(item: TraceToolItem): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(ToolCallCompactBlock, {
      items: [item],
      onOpenWorkspacePath: () => undefined,
      onOpenImage: () => undefined,
    }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("ToolCallCompactBlock image preview", () => {
  it("shows Read and an inline image for a read of a picture", async () => {
    const item: TraceToolItem = {
      type: "tool",
      toolCallId: "read-img",
      title: "Read",
      kind: "read",
      subtitle: ".tmp/playtest/06-continue-a.png",
      status: "completed",
      content: undefined,
      diffRows: undefined,
      detailVisible: false,
      image: { data: "QUJD", mimeType: "image/png" },
    };
    const html = await renderBlock(item);
    expect(html).toContain("Read");
    expect(html).toContain(".tmp/playtest/06-continue-a.png");
    expect(html).toContain('class="tool-call-compact-image"');
    expect(html).toContain("data:image/png;base64,QUJD");
    expect(html).toContain('aria-label="View image"');
  });
});

describe("ToolCallCompactBlock path links", () => {
  it("uses the link color for file paths and the link hover color on hover", () => {
    const css = readFileSync(new URL("./ToolCallCompactBlock.css", import.meta.url), "utf8");
    const rules = css.match(/[^{}]*tool-call-compact-path-link[^{]*\{[^}]*\}/g) ?? [];
    const hover = rules.filter((rule) => rule.includes(":hover") || rule.includes(":focus-visible"));
    const rest = rules.filter((rule) => !hover.includes(rule));
    const colorOf = (rule: string): string => rule.match(/color:\s*([^;]+);/)?.[1]?.trim() ?? "";
    expect(rest.length).toBeGreaterThan(0);
    expect(hover.length).toBeGreaterThan(0);
    for (const color of rest.map(colorOf)) {
      expect(color).toContain("--vscode-textLink-foreground");
      expect(color).not.toContain("--vscode-textLink-activeForeground");
    }
    for (const color of hover.map(colorOf)) {
      expect(color).toContain("--vscode-textLink-activeForeground");
    }
  });
});
