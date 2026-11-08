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
  it("uses the normal foreground for thought text", () => {
    const css = readFileSync(new URL("./AgentThoughtBlock.css", import.meta.url), "utf8");
    expect(css).toContain("color: var(--acp-ui-text-primary)");
    expect(css).not.toContain("--acp-ui-text-secondary");
  });

  it("adds padding around a thought and tool-call group", () => {
    const css = readFileSync(new URL("./TraceList.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.trace-activity-group\s*\{[^}]*padding:\s*var\(--acp-ui-space-20\)\s+0/);
  });
});
