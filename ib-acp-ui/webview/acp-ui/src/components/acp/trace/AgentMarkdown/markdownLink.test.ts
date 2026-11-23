import { describe, expect, it } from "vite-plus/test";
import { markdownExternalUrl, markdownFilePath } from "./markdownLink";

describe("markdownLink", () => {
  it("opens a file URI and an absolute path in the editor", () => {
    expect(markdownFilePath("file:///home/econn/git/app/TODO.md")).toBe("/home/econn/git/app/TODO.md");
    expect(markdownFilePath("/home/econn/git/app/TODO.md")).toBe("/home/econn/git/app/TODO.md");
    expect(markdownFilePath("178ce18c-356c-4b79-90fe-ec7bc776c7ea")).toBeUndefined();
  });

  it("keeps http links as external URLs", () => {
    expect(markdownExternalUrl("https://agentclientprotocol.com")).toBe(
      "https://agentclientprotocol.com",
    );
    expect(markdownExternalUrl("178ce18c-356c-4b79-90fe-ec7bc776c7ea")).toBeUndefined();
  });
});
