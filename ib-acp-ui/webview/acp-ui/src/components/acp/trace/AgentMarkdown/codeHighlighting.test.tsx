import { describe, expect, it } from "vite-plus/test";
import { highlightCodeToNodes, languageFromClassName, tokenizeJsonCode } from "./codeHighlighting";

describe("languageFromClassName", () => {
  it("extracts fenced code language", () => {
    expect(languageFromClassName("language-typescript")).toBe("typescript");
    expect(languageFromClassName(undefined)).toBeUndefined();
  });
});

describe("highlightCodeToNodes", () => {
  it("highlights json, markdown, and typescript deterministically", () => {
    expect(highlightCodeToNodes("json", '{"a":1}').length).toBeGreaterThan(1);
    expect(highlightCodeToNodes("markdown", "# title").length).toBeGreaterThan(1);
    expect(highlightCodeToNodes("typescript", "const value = 2;").length).toBeGreaterThan(1);
  });

  it("falls back to plain text for unknown language", () => {
    expect(highlightCodeToNodes("ruby", "puts :ok")).toEqual(["puts :ok"]);
  });
});

describe("tokenizeJsonCode", () => {
  it("marks quoted keys and string values separately", () => {
    expect(tokenizeJsonCode('{\n  "sessionId": "s1"\n}')).toEqual([
      { kind: "punctuation", text: "{" },
      { kind: "plain", text: "\n  " },
      { kind: "property", text: '"sessionId"' },
      { kind: "punctuation", text: ":" },
      { kind: "plain", text: " " },
      { kind: "string", text: '"s1"' },
      { kind: "plain", text: "\n" },
      { kind: "punctuation", text: "}" },
    ]);
  });

  it("highlights punctuation, booleans, and numbers", () => {
    expect(tokenizeJsonCode('["a", 1, true, null]')).toEqual([
      { kind: "punctuation", text: "[" },
      { kind: "string", text: '"a"' },
      { kind: "punctuation", text: "," },
      { kind: "plain", text: " " },
      { kind: "number", text: "1" },
      { kind: "punctuation", text: "," },
      { kind: "plain", text: " " },
      { kind: "keyword", text: "true" },
      { kind: "punctuation", text: "," },
      { kind: "plain", text: " " },
      { kind: "keyword", text: "null" },
      { kind: "punctuation", text: "]" },
    ]);
  });
});
