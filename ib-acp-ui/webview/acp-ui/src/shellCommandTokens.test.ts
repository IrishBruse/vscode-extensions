import { describe, expect, it } from "vite-plus/test";
import {
  tokenizeShellCommand,
  type ShellHighlightKind,
  type ShellHighlightToken,
} from "./shellCommandTokens";

function kinds(tokens: ShellHighlightToken[]): ShellHighlightKind[] {
  return tokens.map((token) => token.kind);
}

function texts(tokens: ShellHighlightToken[]): string[] {
  return tokens.map((token) => token.text);
}

describe("tokenizeShellCommand", () => {
  it("highlights the first word as command and later words as arguments", () => {
    const tokens = tokenizeShellCommand("git status");
    expect(kinds(tokens)).toEqual(["command", "whitespace", "argument"]);
    expect(texts(tokens)).toEqual(["git", " ", "status"]);
  });

  it("marks flags as options", () => {
    const tokens = tokenizeShellCommand("rg -n pattern src/");
    expect(kinds(tokens)).toEqual([
      "command",
      "whitespace",
      "option",
      "whitespace",
      "argument",
      "whitespace",
      "path",
    ]);
  });

  it("resets command highlighting after a pipe", () => {
    const tokens = tokenizeShellCommand("cat file.txt | wc -l");
    expect(kinds(tokens)).toEqual([
      "command",
      "whitespace",
      "argument",
      "whitespace",
      "operator",
      "whitespace",
      "command",
      "whitespace",
      "option",
    ]);
  });

  it("preserves quoted strings and variables", () => {
    const tokens = tokenizeShellCommand('echo "$HOME/docs"');
    expect(kinds(tokens)).toEqual(["command", "whitespace", "string"]);
    expect(texts(tokens)[2]).toBe('"$HOME/docs"');
  });

  it("tokenizes redirects and chained operators", () => {
    const tokens = tokenizeShellCommand("npm test 2>&1 && echo done");
    expect(kinds(tokens)).toContain("redirect");
    expect(kinds(tokens)).toContain("operator");
    expect(texts(tokens).join("")).toBe("npm test 2>&1 && echo done");
  });

  it("colors a redirect target as a path and the next command after a pipe", () => {
    const tokens = tokenizeShellCommand('as --help foo "test" | code test > /dev/null');
    expect(kinds(tokens)).toEqual([
      "command",
      "whitespace",
      "option",
      "whitespace",
      "argument",
      "whitespace",
      "string",
      "whitespace",
      "operator",
      "whitespace",
      "command",
      "whitespace",
      "argument",
      "whitespace",
      "redirect",
      "whitespace",
      "path",
    ]);
  });

  it("treats trailing hash as comment", () => {
    const tokens = tokenizeShellCommand("ls -la # list all");
    expect(kinds(tokens)).toEqual([
      "command",
      "whitespace",
      "option",
      "whitespace",
      "comment",
    ]);
    expect(texts(tokens).at(-1)).toBe("# list all");
  });

  it("ends a hash comment at the line break", () => {
    const tokens = tokenizeShellCommand("echo hi # note\necho next");
    const comment = tokens.find((token) => token.kind === "comment");
    expect(comment?.text).toBe("# note");
    expect(texts(tokens)).toContain("next");
  });
});
