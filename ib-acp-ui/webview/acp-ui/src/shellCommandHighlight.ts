export type ShellHighlightKind =
  | "command"
  | "argument"
  | "option"
  | "string"
  | "variable"
  | "operator"
  | "redirect"
  | "comment"
  | "whitespace";

export type ShellHighlightToken = {
  kind: ShellHighlightKind;
  text: string;
};

const REDIRECTS = new Set([">", "<"]);
const OPERATORS = new Set(["|", "&", ";", "(", ")"]);

function pushToken(tokens: ShellHighlightToken[], kind: ShellHighlightKind, text: string): void {
  if (text.length === 0) {
    return;
  }
  const last = tokens[tokens.length - 1];
  if (last !== undefined && last.kind === kind) {
    last.text += text;
    return;
  }
  tokens.push({ kind, text });
}

/**
 * Fish-inspired shell command tokenizer for compact terminal tool headers.
 */
export function tokenizeShellCommand(command: string): ShellHighlightToken[] {
  const tokens: ShellHighlightToken[] = [];
  let index = 0;
  let atSegmentStart = true;

  const readWord = (): string => {
    const start = index;
    while (index < command.length) {
      const ch = command[index] ?? "";
      if (/\s/.test(ch) || REDIRECTS.has(ch) || OPERATORS.has(ch) || ch === "#" || ch === "$") {
        break;
      }
      index += 1;
    }
    return command.slice(start, index);
  };

  const readString = (quote: "'" | '"'): string => {
    const start = index;
    index += 1;
    while (index < command.length) {
      const ch = command[index] ?? "";
      if (ch === "\\" && quote === '"') {
        index += 2;
        continue;
      }
      index += 1;
      if (ch === quote) {
        break;
      }
    }
    return command.slice(start, index);
  };

  const readVariable = (): string => {
    const start = index;
    index += 1;
    if (command[index] === "{") {
      index += 1;
      while (index < command.length && (command[index] ?? "") !== "}") {
        index += 1;
      }
      if (index < command.length) {
        index += 1;
      }
      return command.slice(start, index);
    }
    while (index < command.length) {
      const ch = command[index] ?? "";
      if (!/[A-Za-z0-9_]/.test(ch)) {
        break;
      }
      index += 1;
    }
    return command.slice(start, index);
  };

  const classifyWord = (word: string): ShellHighlightKind => {
    if (atSegmentStart) {
      return "command";
    }
    if (word.startsWith("-")) {
      return "option";
    }
    return "argument";
  };

  const markOperator = (): void => {
    atSegmentStart = true;
  };

  while (index < command.length) {
    const ch = command[index] ?? "";

    if (/\s/.test(ch)) {
      const start = index;
      while (index < command.length && /\s/.test(command[index] ?? "")) {
        index += 1;
      }
      pushToken(tokens, "whitespace", command.slice(start, index));
      continue;
    }

    if (ch === "#") {
      pushToken(tokens, "comment", command.slice(index));
      break;
    }

    if (ch === "'" || ch === '"') {
      const text = readString(ch);
      pushToken(tokens, "string", text);
      atSegmentStart = false;
      continue;
    }

    if (ch === "$") {
      pushToken(tokens, "variable", readVariable());
      atSegmentStart = false;
      continue;
    }

    if (ch === ">" || ch === "<") {
      let text = ch;
      index += 1;
      if (index < command.length && (command[index] ?? "") === ch) {
        text += ch;
        index += 1;
      }
      pushToken(tokens, "redirect", text);
      markOperator();
      continue;
    }

    if (ch === "|" && (command[index + 1] ?? "") === "|") {
      pushToken(tokens, "operator", "||");
      index += 2;
      markOperator();
      continue;
    }

    if (ch === "&" && (command[index + 1] ?? "") === "&") {
      pushToken(tokens, "operator", "&&");
      index += 2;
      markOperator();
      continue;
    }

    if (ch === "|" || ch === ";" || ch === "(" || ch === ")") {
      pushToken(tokens, "operator", ch);
      index += 1;
      if (ch === "|" || ch === ";") {
        markOperator();
      }
      continue;
    }

    if (ch === "&") {
      if ((command[index + 1] ?? "") === ">") {
        pushToken(tokens, "redirect", "&>");
        index += 2;
        markOperator();
        continue;
      }
      pushToken(tokens, "operator", ch);
      index += 1;
      continue;
    }

    if (/\d/.test(ch) && command.slice(index, index + 3) === "2>&") {
      let text = "2>&";
      index += 3;
      while (index < command.length) {
        const next = command[index] ?? "";
        if (next === " " || REDIRECTS.has(next) || OPERATORS.has(next)) {
          break;
        }
        text += next;
        index += 1;
      }
      pushToken(tokens, "redirect", text);
      markOperator();
      continue;
    }

    const word = readWord();
    const kind = classifyWord(word);
    pushToken(tokens, kind, word);
    if (kind === "command") {
      atSegmentStart = false;
    }
  }

  return tokens;
}
