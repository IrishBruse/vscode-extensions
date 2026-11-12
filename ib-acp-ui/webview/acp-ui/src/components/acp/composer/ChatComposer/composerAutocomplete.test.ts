import { describe, expect, it } from "vite-plus/test";
import { buildComposerAutocompleteState, wrapIndex } from "./composerAutocomplete";

describe("buildComposerAutocompleteState", () => {
  it("builds slash suggestions and filters by prefix", () => {
    const state = buildComposerAutocompleteState({
      draft: "/re",
      caret: 3,
      slashCommands: [
        { name: "rename", description: "Rename chat" },
        { name: "reset", description: "Reset session" },
        { name: "clear", description: "Clear trace" },
      ],
      workspaceFiles: [],
    });
    expect(state?.mode).toBe("slash");
    expect(state?.items.map((item) => item.primary)).toEqual(["/rename", "/reset"]);
  });

  it("splits trailing skill labels and groups slash commands", () => {
    const state = buildComposerAutocompleteState({
      draft: "/",
      caret: 1,
      slashCommands: [
        {
          name: "release",
          description: "Bump version (user skill) (global)",
        },
        {
          name: "docs",
          description: "Align docs (user skill) (workspace)",
        },
        { name: "rename", description: "Rename chat" },
      ],
      workspaceFiles: [],
    });
    expect(state?.groups.map((group) => group.label)).toEqual([
      undefined,
      "workspace",
      "user skill",
    ]);
    expect(state?.items.map((item) => item.primary)).toEqual(["/rename", "/docs", "/release"]);
    expect(state?.items.find((item) => item.primary === "/release")).toMatchObject({
      secondary: "Bump version",
      source: "user skill · global",
    });
  });

  it("orders slash items to match the highlighted menu row", () => {
    const state = buildComposerAutocompleteState({
      draft: "/unatte",
      caret: "/unatte".length,
      slashCommands: [
        {
          name: "unattended-pr",
          description: "Finish work end to end and stop with a draft PR (user skill)",
        },
        {
          name: "unattended",
          description: "Finish work end to end without the user watching (user skill)",
        },
      ],
      workspaceFiles: [],
    });
    expect(state?.items.map((item) => item.primary)).toEqual(["/unattended", "/unattended-pr"]);
  });

  it("builds file suggestions for @ query", () => {
    const state = buildComposerAutocompleteState({
      draft: "read @chat",
      caret: "read @chat".length,
      slashCommands: [],
      workspaceFiles: ["src/chatReducer.ts", "src/main.ts"],
    });
    expect(state?.mode).toBe("file");
    expect(state?.items[0]?.insertText).toBe("@src/chatReducer.ts ");
  });
});

describe("wrapIndex", () => {
  it("wraps up and down navigation", () => {
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(3, 3)).toBe(0);
  });
});
