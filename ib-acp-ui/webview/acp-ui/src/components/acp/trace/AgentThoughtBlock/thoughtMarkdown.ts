/** Drops fenced code blocks, including a fence that is still open. */
export function omitFencedCodeBlocks(text: string): string {
  let result = "";
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("```", index);
    if (open < 0) {
      result += text.slice(index);
      break;
    }
    result += text.slice(index, open);
    const close = text.indexOf("```", open + 3);
    if (close < 0) {
      break;
    }
    index = close + 3;
  }
  return result;
}
