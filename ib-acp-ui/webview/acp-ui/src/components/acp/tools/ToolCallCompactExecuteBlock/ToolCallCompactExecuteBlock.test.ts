import { readFileSync } from "node:fs";
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
    expect(html.indexOf('aria-label="Command output"')).toBeLessThan(html.indexOf("Hide output"));
    expect(html).toContain("line 1");
    expect(html).toContain("line 8");
  });

  it("shows the working directory and elapsed time above the command", async () => {
    const html = await renderBlock({
      ...executeItem("", "echo test"),
      cwd: "~/foo/bar",
      durationMs: 2100,
    });
    const pathAt = html.indexOf("~/foo/bar");
    const timeAt = html.indexOf("2.1s");
    const commandAt = html.indexOf("echo");
    expect(pathAt).toBeGreaterThanOrEqual(0);
    expect(timeAt).toBeGreaterThan(pathAt);
    expect(commandAt).toBeGreaterThan(timeAt);
    expect(html.indexOf("tool-call-compact-execute-cwd")).toBeLessThan(
      html.indexOf("tool-call-compact-execute-command"),
    );
  });

  it("keeps line breaks in the command", async () => {
    const html = await renderBlock(executeItem("", "python3 << 'PY'\nfrom PIL import Image"));
    expect(html).toContain("python3");
    expect(html).toContain("shell-hl--whitespace\">\n</span>");
    expect(html).toContain(">from</span>");
  });

  it("shows command output without a left bar", () => {
    const css = readFileSync(new URL("./ToolCallCompactExecuteBlock.css", import.meta.url), "utf8");
    const rule = css.match(/\.tool-call-compact-execute-output\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("margin: 4px 0 0 0");
    expect(rule).toContain("border-radius: var(--acp-ui-radius-sm)");
    expect(rule).toContain(
      "background-color: var(--vscode-input-background, var(--acp-ui-surface-panel))",
    );
    expect(rule).not.toContain("border-left");
    expect(rule).not.toContain("--vscode-textBlockQuote-background");
    expect(rule).not.toContain("--vscode-textBlockQuote-border");
    const commandRule =
      css.match(/\.tool-call-compact-execute-command-text\s*\{[^}]*\}/)?.[0] ?? "";
    expect(commandRule).toContain("white-space: pre-wrap");
  });
});
