export type PermissionTitlePart =
  | { kind: "text"; text: string }
  | { kind: "path"; text: string };

/** A backtick span is a file path when it contains a slash or starts like a relative path. */
export function backtickLooksLikePath(value: string): boolean {
  return value.includes("/") || value.startsWith("~") || value.startsWith(".");
}

/**
 * Splits an agent tool title into text and path spans.
 * Paths use the text inside backticks.
 */
export function permissionTitleParts(raw: string): PermissionTitlePart[] {
  const parts: PermissionTitlePart[] = [];
  const pattern = /`([^`]+)`/g;
  let last = 0;
  for (const match of raw.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ kind: "text", text: raw.slice(last, index) });
    }
    const inner = match[1]?.trim() ?? "";
    if (inner.length > 0) {
      parts.push(
        backtickLooksLikePath(inner) ? { kind: "path", text: inner } : { kind: "text", text: inner },
      );
    }
    last = index + match[0].length;
  }
  if (last < raw.length) {
    parts.push({ kind: "text", text: raw.slice(last) });
  }
  if (parts.length === 0) {
    parts.push({ kind: "text", text: raw });
  }
  return parts;
}
