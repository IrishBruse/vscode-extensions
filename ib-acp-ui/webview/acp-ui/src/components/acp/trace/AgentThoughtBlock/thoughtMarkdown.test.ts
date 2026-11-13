import { describe, expect, it } from "vite-plus/test";
import { omitFencedCodeBlocks } from "./thoughtMarkdown";

describe("omitFencedCodeBlocks", () => {
  it("drops a closed fence and keeps the surrounding text", () => {
    expect(omitFencedCodeBlocks("Before\n\n```ts\nconst n = 1;\n```\n\nAfter")).toBe(
      "Before\n\n\n\nAfter",
    );
  });

  it("drops an open fence through the end of the text", () => {
    expect(omitFencedCodeBlocks("Look\n```\nconst n = 1;")).toBe("Look\n");
  });

  it("keeps inline code", () => {
    expect(omitFencedCodeBlocks("Check `sessionReducer` first.")).toBe(
      "Check `sessionReducer` first.",
    );
  });
});
