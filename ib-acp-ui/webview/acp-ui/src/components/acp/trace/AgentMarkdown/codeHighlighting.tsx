import type { ReactElement, ReactNode } from "react";

type TokenKind = "plain" | "keyword" | "string" | "number" | "comment" | "operator" | "punctuation";

type Token = { kind: TokenKind; text: string };

function tokensToNodes(tokens: Token[]): ReactNode[] {
  return tokens.map((token, index) =>
    token.kind === "plain" ? (
      token.text
    ) : (
      <span key={`${token.kind}-${index}`} className={`code-token-${token.kind}`}>
        {token.text}
      </span>
    ),
  );
}

function tokenizeByRegex(text: string, expression: RegExp, kind: TokenKind): Token[] {
  const out: Token[] = [];
  let last = 0;
  let match = expression.exec(text);
  while (match !== null) {
    const start = match.index;
    const value = match[0] ?? "";
    if (start > last) {
      out.push({ kind: "plain", text: text.slice(last, start) });
    }
    out.push({ kind, text: value });
    last = start + value.length;
    match = expression.exec(text);
  }
  if (last < text.length) {
    out.push({ kind: "plain", text: text.slice(last) });
  }
  return out;
}

export function languageFromClassName(className: string | undefined): string | undefined {
  if (className === undefined) {
    return undefined;
  }
  const match = className.match(/language-([a-z0-9_-]+)/i);
  return match?.[1]?.toLowerCase();
}

let highlightCodeBuilds = 0;
const highlightTokenCache = new Map<string, Token[]>();
const highlightTokenCacheLimit = 80;

/** How many times code was tokenized. Repeat calls for the same text reuse the cache. */
export function highlightCodeBuildCount(): number {
  return highlightCodeBuilds;
}

function cachedHighlightTokens(language: string, code: string, build: () => Token[]): Token[] {
  const key = `${language}\0${code}`;
  const cached = highlightTokenCache.get(key);
  if (cached !== undefined) {
    highlightTokenCache.delete(key);
    highlightTokenCache.set(key, cached);
    return cached;
  }
  highlightCodeBuilds += 1;
  const tokens = build();
  highlightTokenCache.set(key, tokens);
  if (highlightTokenCache.size > highlightTokenCacheLimit) {
    const oldest = highlightTokenCache.keys().next().value;
    if (oldest !== undefined) {
      highlightTokenCache.delete(oldest);
    }
  }
  return tokens;
}

export function highlightCodeToNodes(language: string | undefined, code: string): ReactNode[] {
  if (language === "json") {
    const quoted = cachedHighlightTokens(language, code, () =>
      tokenizeByRegex(code, /"(?:\\.|[^"\\])*"/g, "string").flatMap((token) => {
        if (token.kind !== "plain") {
          return [token];
        }
        return tokenizeByRegex(token.text, /\b-?\d+(?:\.\d+)?\b/g, "number");
      }),
    );
    return tokensToNodes(quoted);
  }
  if (language === "typescript" || language === "ts") {
    const keywords =
      /\b(?:const|let|var|function|class|interface|type|return|if|else|for|while|import|export|from|extends|implements|new|async|await|try|catch|throw)\b/g;
    const numbers = /\b\d+(?:\.\d+)?\b/g;
    const tokens = cachedHighlightTokens(language, code, () =>
      tokenizeByRegex(code, /\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "comment").flatMap((token) => {
        if (token.kind !== "plain") {
          return [token];
        }
        return tokenizeByRegex(token.text, keywords, "keyword").flatMap((kToken) => {
          if (kToken.kind !== "plain") {
            return [kToken];
          }
          return tokenizeByRegex(kToken.text, numbers, "number");
        });
      }),
    );
    return tokensToNodes(tokens);
  }
  if (language === "markdown" || language === "md") {
    const headers = cachedHighlightTokens(language, code, () =>
      tokenizeByRegex(code, /^#{1,6}\s.*$/gm, "keyword").flatMap((token) => {
        if (token.kind !== "plain") {
          return [token];
        }
        return tokenizeByRegex(token.text, /`[^`\n]+`/g, "string");
      }),
    );
    return tokensToNodes(headers);
  }
  return [code];
}

export function renderHighlightedCode(language: string | undefined, code: string): ReactElement {
  return <>{highlightCodeToNodes(language, code)}</>;
}
