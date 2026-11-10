import { describe, expect, it } from "vite-plus/test";
import type { TraceToolItem } from "./chatReducer";
import {
  compactGroupHiddenDetailCount,
  compactToolDetailLine,
  compactToolDetailParts,
  compactToolGroupSummary,
  compactToolGroupSummaryParts,
  diffLineStats,
  executeOutputPreview,
  isCompactGroupableTool,
  setCompactToolPathHome,
  setCompactToolWorkspaceRoot,
  toolCallDetailKind,
} from "./toolCallCompactText";

function toolItem(
  overrides: Partial<TraceToolItem> & Pick<TraceToolItem, "toolCallId">,
): TraceToolItem {
  return {
    type: "tool",
    title: "Tool",
    kind: undefined,
    subtitle: undefined,
    status: "completed",
    content: undefined,
    diffRows: undefined,
    detailVisible: false,
    ...overrides,
  };
}

describe("toolCallDetailKind", () => {
  it("always shows a write as a diff when diff rows exist", () => {
    expect(
      toolCallDetailKind(
        toolItem({
          toolCallId: "edit-1",
          kind: "edit",
          title: "Write File",
          subtitle: "src/app.ts",
          detailVisible: false,
          diffRows: [
            { kind: "context", text: "const a = 1;" },
            { kind: "removed", text: "const b = 2;" },
            { kind: "added", text: "const b = 3;" },
          ],
        }),
      ),
    ).toBe("diff");
  });

  it("keeps a whole-file read as a summary line even when file text is present", () => {
    expect(
      toolCallDetailKind(
        toolItem({
          toolCallId: "read-1",
          kind: "read",
          subtitle: "src/app.ts",
          content: "export const value = 1;\n",
          detailVisible: true,
        }),
      ),
    ).toBe("summary");
  });

  it("makes a ranged read with file text clickable for more detail", () => {
    expect(
      toolCallDetailKind(
        toolItem({
          toolCallId: "read-range",
          kind: "read",
          subtitle: "src/app.ts",
          content: "lines 12-40\nexport const value = 1;\n",
          detailVisible: true,
        }),
      ),
    ).toBe("expandable");
  });

  it("leaves a read with no file text as a summary line", () => {
    expect(
      toolCallDetailKind(
        toolItem({
          toolCallId: "read-2",
          kind: "read",
          subtitle: "src/app.ts",
        }),
      ),
    ).toBe("summary");
  });
});

describe("toolCallCompactText", () => {
  it("links a saved plan markdown file so it opens as that file", () => {
    setCompactToolPathHome("/home/econn");
    const parts = compactToolDetailParts(
      toolItem({
        toolCallId: "plan-1",
        title: "Create Plan",
        subtitle: '{"_toolName":"createPlan"}',
        content:
          "Plan saved to file:///home/econn/.cursor/plans/Thought%20block%20redesign-4084c8ed.plan.md",
      }),
    );
    expect(parts.pathSegment?.openPath).toBe(
      "/home/econn/.cursor/plans/Thought block redesign-4084c8ed.plan.md",
    );
    expect(parts.pathSegment?.openTarget).toBeUndefined();
  });

  it("shows a long file path from the end, up to 50 characters", () => {
    setCompactToolPathHome("/home/econn");
    const item = toolItem({
      toolCallId: "read-settings",
      kind: "read",
      subtitle: "/home/econn/git/dotfiles/home/.config/Cursor/User/settings.json",
    });
    expect(compactToolDetailLine(item)).toBe(
      "Read ...dotfiles/home/.config/Cursor/User/settings.json",
    );
    expect(compactToolDetailParts(item).pathSegment?.label).toBe(
      "...dotfiles/home/.config/Cursor/User/settings.json",
    );
    expect(compactToolDetailParts(item).pathSegment?.title).toBe(
      "~/git/dotfiles/home/.config/Cursor/User/settings.json",
    );
  });

  it("shows a tilde path under the agent working directory as a relative path", () => {
    setCompactToolPathHome("/home/econn");
    setCompactToolWorkspaceRoot("/home/econn/git/agent-canvas");
    const item = toolItem({
      toolCallId: "read-cwd",
      kind: "read",
      subtitle: "~/git/agent-canvas/.tmp/compare.png",
    });
    expect(compactToolDetailLine(item)).toBe("Read .tmp/compare.png");
    expect(compactToolDetailParts(item).pathSegment).toMatchObject({
      label: ".tmp/compare.png",
      title: ".tmp/compare.png",
      openPath: "~/git/agent-canvas/.tmp/compare.png",
    });
  });

  it("clips absolute paths under the workspace root to workspace-relative labels", () => {
    setCompactToolPathHome("/home/econn");
    setCompactToolWorkspaceRoot("/home/econn/git/vscode-extensions");
    const item = toolItem({
      toolCallId: "read-ws",
      kind: "read",
      subtitle:
        "/home/econn/git/vscode-extensions/ib-acp-ui/webview/acp-ui/src/visibleTraceTail.ts",
    });
    expect(compactToolDetailLine(item)).toBe(
      "Read ib-acp-ui/webview/acp-ui/src/visibleTraceTail.ts",
    );
    expect(compactToolDetailParts(item).pathSegment).toMatchObject({
      label: "ib-acp-ui/webview/acp-ui/src/visibleTraceTail.ts",
      title: "ib-acp-ui/webview/acp-ui/src/visibleTraceTail.ts",
      openPath:
        "/home/econn/git/vscode-extensions/ib-acp-ui/webview/acp-ui/src/visibleTraceTail.ts",
    });
  });

  it("shortens absolute paths under home in compact labels", () => {
    setCompactToolPathHome("/home/econn");
    setCompactToolWorkspaceRoot("");
    const item = toolItem({
      toolCallId: "read-abs",
      kind: "read",
      subtitle: "/home/econn/git/vscode-acp-ui/AGENTS.md",
    });
    expect(compactToolDetailLine(item)).toBe("Read ~/git/vscode-acp-ui/AGENTS.md");
    expect(compactToolDetailParts(item)).toMatchObject({
      verb: "Read",
      detail: "~/git/vscode-acp-ui/AGENTS.md",
      pathSegment: {
        label: "~/git/vscode-acp-ui/AGENTS.md",
        title: "~/git/vscode-acp-ui/AGENTS.md",
        openPath: "/home/econn/git/vscode-acp-ui/AGENTS.md",
      },
    });
    const grep = toolItem({
      toolCallId: "grep-abs",
      kind: "search",
      title: "Grep",
      subtitle: "/home/econn/git/vscode-acp-ui",
    });
    expect(compactToolDetailLine(grep)).toBe("Grepped ~/git/vscode-acp-ui");
    expect(compactToolDetailParts(grep).pathSegment?.title).toBe("~/git/vscode-acp-ui");
  });

  it("formats a single edit with diff stats", () => {
    const item = toolItem({
      toolCallId: "edit-1",
      kind: "edit",
      subtitle: "webview/acp-ui/src/chatReducer.test.ts",
      diffRows: [
        { kind: "context", text: " unchanged" },
        { kind: "added", text: "+line" },
        { kind: "added", text: "+line2" },
      ],
    });
    expect(compactToolDetailLine(item)).toBe("Edited webview/acp-ui/src/chatReducer.test.ts +2");
    expect(compactToolGroupSummary([item])).toBe(
      "Edited webview/acp-ui/src/chatReducer.test.ts +2",
    );
  });

  it("formats read tools with optional line ranges", () => {
    const item = toolItem({
      toolCallId: "read-1",
      kind: "read",
      title: "Read File",
      subtitle: "webview/acp-ui/src/chatReducer.test.ts",
      content: "lines 218-267\nbody",
    });
    expect(compactToolDetailLine(item)).toBe(
      "Read webview/acp-ui/src/chatReducer.test.ts lines 218-267",
    );
  });

  it("avoids repeating generic read titles when path is unknown", () => {
    const item = toolItem({
      toolCallId: "read-sparse",
      kind: "read",
      title: "Read File",
    });
    expect(compactToolDetailLine(item)).toBe("Read");
  });

  it("formats grep tools with pattern and path", () => {
    const item = toolItem({
      toolCallId: "grep-1",
      kind: "search",
      title: "Grep",
      subtitle: "webview/acp-ui/src/chatReducer.test.ts",
      content: 'Grepped "createChatStateFromInit" in webview/acp-ui/src/chatReducer.test.ts',
    });
    expect(compactToolDetailLine(item)).toBe(
      'Grepped "createChatStateFromInit" in webview/acp-ui/src/chatReducer.test.ts',
    );
  });

  it("shows match counts for sparse Cursor-style grep tools", () => {
    const item = toolItem({
      toolCallId: "grep-sparse",
      kind: "search",
      title: "grep",
      subtitle: "2 matches",
      content: "2 match(es), complete",
    });
    expect(compactToolDetailLine(item)).toBe("Grepped 2 matches");
  });

  it("drops a leading exit 0 line from terminal output", () => {
    const item = toolItem({
      toolCallId: "run-exit",
      kind: "execute",
      subtitle: "npm test",
      content: "exit 0\nPASS\n",
    });
    expect(executeOutputPreview(item, true)).toMatchObject({
      previewLines: ["PASS"],
      totalLineCount: 1,
    });
  });

  it("previews long terminal output with a hidden-line hint and last line", () => {
    const lines = Array.from({ length: 24 }, (_, index) => `line ${index}`);
    lines[23] = "✓ built in 132ms";
    const item = toolItem({
      toolCallId: "run-1",
      kind: "execute",
      subtitle: "npm run build:webview",
      content: `$ npm run build:webview\n${lines.join("\n")}`,
    });
    expect(executeOutputPreview(item, false)).toEqual({
      previewLines: ["✓ built in 132ms"],
      hiddenLineCount: 23,
      totalLineCount: 24,
    });
  });

  it("counts hidden grouped detail lines", () => {
    expect(compactGroupHiddenDetailCount(14, 3)).toBe(11);
    expect(compactGroupHiddenDetailCount(3, 3)).toBe(0);
    expect(compactGroupHiddenDetailCount(2, 3)).toBe(0);
  });

  it("summarizes grouped reads, greps, and globs in cursor order", () => {
    const items = [
      toolItem({
        toolCallId: "read-1",
        kind: "read",
        subtitle: "src/a.ts",
      }),
      toolItem({
        toolCallId: "glob-1",
        kind: "glob",
        title: "Glob",
        content: 'Globbed "**/*.ts" in .',
      }),
      toolItem({
        toolCallId: "grep-1",
        kind: "search",
        subtitle: ".",
        content: 'Grepped "foo" in .',
      }),
    ];
    expect(compactToolGroupSummary(items)).toBe("Read, grepped, globbed 1 file, 1 grep, 1 glob");
  });

  it("summarizes grouped reads and grep", () => {
    const items = [
      toolItem({
        toolCallId: "read-1",
        kind: "read",
        subtitle: "webview/acp-ui/src/ui.tsx",
      }),
      toolItem({
        toolCallId: "read-2",
        kind: "read",
        subtitle: "webview/acp-ui/src/main.ts",
      }),
      toolItem({
        toolCallId: "read-3",
        kind: "read",
        subtitle: "webview/acp-ui/src/chatReducer.test.ts",
        content: "lines 218-267",
      }),
      toolItem({
        toolCallId: "grep-1",
        kind: "search",
        subtitle: "webview/acp-ui/src/chatReducer.test.ts",
        content: 'Grepped "createChatStateFromInit" in webview/acp-ui/src/chatReducer.test.ts',
      }),
    ];
    expect(compactToolGroupSummary(items)).toBe("Read, grepped 3 files, 1 grep");
    expect(compactToolGroupSummaryParts(items)).toEqual({
      verbs: "Read, grepped",
      counts: "3 files, 1 grep",
    });
  });

  it("splits verb and detail for styling", () => {
    const item = toolItem({
      toolCallId: "read-1",
      kind: "read",
      subtitle: "webview/acp-ui/src/components/TraceList.css",
    });
    expect(compactToolDetailParts(item)).toEqual({
      verb: "Read",
      detail: "webview/acp-ui/src/components/TraceList.css",
      pathSegment: {
        label: "webview/acp-ui/src/components/TraceList.css",
        title: "webview/acp-ui/src/components/TraceList.css",
        openPath: "webview/acp-ui/src/components/TraceList.css",
      },
    });
    expect(compactToolDetailParts(item).pathSegment?.openTarget).toBeUndefined();
  });

  it("marks grep paths for auto open (folder reveal or file editor)", () => {
    const item = toolItem({
      toolCallId: "grep-1",
      kind: "search",
      title: "Grep",
      subtitle: "/home/econn/git/vscode-acp-ui",
    });
    setCompactToolPathHome("/home/econn");
    expect(compactToolDetailParts(item).pathSegment?.openTarget).toBe("auto");
  });

  it("treats kind grep like search for compact formatting", () => {
    const item = toolItem({
      toolCallId: "grep-kind",
      kind: "grep",
      title: "Tool",
      subtitle: "/home/econn/git/vscode-acp-ui",
    });
    setCompactToolPathHome("/home/econn");
    expect(compactToolDetailLine(item)).toBe("Grepped ~/git/vscode-acp-ui");
    expect(compactToolDetailParts(item).pathSegment?.openTarget).toBe("auto");
  });

  it("counts diff rows", () => {
    expect(
      diffLineStats([
        { kind: "removed", text: "a" },
        { kind: "added", text: "b" },
        { kind: "added", text: "c" },
      ]),
    ).toEqual({ added: 2, removed: 1 });
  });

  it("keeps execute tools out of compact groups", () => {
    expect(isCompactGroupableTool(toolItem({ toolCallId: "run-1", kind: "execute" }))).toBe(false);
    expect(isCompactGroupableTool(toolItem({ toolCallId: "read-1", kind: "read" }))).toBe(true);
  });
});
