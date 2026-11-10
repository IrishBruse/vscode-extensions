import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { activityGroupRanges } from "./traceActivityGroup";

describe("activityGroupRanges", () => {
  it("wraps a run of thoughts and tool calls as one group", () => {
    expect(
      activityGroupRanges(["user", "thought", "tool", "tool", "agent", "thought"]),
    ).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 5 },
    ]);
  });

  it("leaves user and agent text outside the group", () => {
    expect(activityGroupRanges(["user", "agent"])).toEqual([]);
  });
});

describe("trace text color and group padding", () => {
  it("uses quieter description text for the thought heading and body", () => {
    const css = readFileSync(
      new URL("../AgentThoughtBlock/AgentThoughtBlock.css", import.meta.url),
      "utf8",
    );
    const quiet = String.raw`color:\s*var\(--vscode-descriptionForeground,\s*var\(--acp-ui-text-secondary\)\)`;
    expect(css).toMatch(new RegExp(String.raw`\.agent-thought-chunk-title\s*\{[^}]*${quiet}`));
    expect(css).toMatch(new RegExp(String.raw`\.agent-thought-chunk-body\s*\{[^}]*${quiet}`));
    expect(css).toMatch(/\.agent-thought-chunk-body\s*\{[^}]*height:\s*3lh/);
  });

  it("adds padding around a thought and tool-call group", () => {
    const css = readFileSync(new URL("./TraceList.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.trace-activity-group\s*\{[^}]*padding:\s*var\(--acp-ui-space-20\)\s+0/);
  });
});
