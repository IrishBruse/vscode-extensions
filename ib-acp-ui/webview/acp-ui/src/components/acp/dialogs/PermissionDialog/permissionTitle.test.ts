import { describe, expect, it } from "vite-plus/test";
import { permissionTitleParts } from "./permissionTitle";

describe("permissionTitleParts", () => {
  it("keeps a delete title and marks the file path", () => {
    expect(
      permissionTitleParts(
        "Delete `/home/econn/git/vscode-extensions/ib-acp-ui/src/extension/acpUiChatOverview.test.ts`",
      ),
    ).toEqual([
      { kind: "text", text: "Delete " },
      {
        kind: "path",
        text: "/home/econn/git/vscode-extensions/ib-acp-ui/src/extension/acpUiChatOverview.test.ts",
      },
    ]);
  });

  it("leaves a shell command as text", () => {
    expect(permissionTitleParts("`git status`")).toEqual([{ kind: "text", text: "git status" }]);
  });
});
