export type MarkdownFileUriSpan =
    | { kind: "text"; text: string }
    | { kind: "file"; text: string; path: string };

/** Decodes a `file://` URI to a filesystem path. */
export function filesystemPathFromFileUri(text: string): string | undefined {
    const trimmed = text.trim();
    if (!trimmed.toLowerCase().startsWith("file:")) {
        return undefined;
    }
    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return undefined;
    }
    if (url.protocol !== "file:") {
        return undefined;
    }
    let path = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:\//.test(path)) {
        path = path.slice(1);
    }
    if (path.length === 0) {
        return undefined;
    }
    return path;
}

function isMarkdownPath(path: string): boolean {
    return path.toLowerCase().endsWith(".md");
}

/** First markdown `file://` URI in a tool line, as a filesystem path. */
export function markdownFilesystemPathFromText(text: string): string | undefined {
    const match = text.match(/file:\/\/[^\s)]+/i);
    if (match === null) {
        return undefined;
    }
    const raw = match[0].replace(/[.,;:]+$/, "");
    const path = filesystemPathFromFileUri(raw);
    if (path === undefined || !isMarkdownPath(path)) {
        return undefined;
    }
    return path;
}

/** Splits text so each markdown `file://` URI can open as that file. */
export function splitMarkdownFileUris(text: string): MarkdownFileUriSpan[] {
    const spans: MarkdownFileUriSpan[] = [];
    const pattern = /file:\/\/[^\s)]+/gi;
    let last = 0;
    for (const match of text.matchAll(pattern)) {
        const index = match.index ?? 0;
        const token = match[0];
        const raw = token.replace(/[.,;:]+$/, "");
        const path = filesystemPathFromFileUri(raw);
        if (path === undefined || !isMarkdownPath(path)) {
            continue;
        }
        if (index > last) {
            spans.push({ kind: "text", text: text.slice(last, index) });
        }
        spans.push({ kind: "file", text: raw, path });
        last = index + raw.length;
    }
    if (last < text.length) {
        spans.push({ kind: "text", text: text.slice(last) });
    }
    if (spans.length === 0) {
        return [{ kind: "text", text }];
    }
    return spans;
}
