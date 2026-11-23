export type HttpUrlSpan =
    | { kind: "text"; text: string }
    | { kind: "url"; text: string; url: string };

const httpUrlPattern = /https?:\/\/[^\s<>)\]]+/gi;

/** Splits text so each http(s) URL can open outside the chat. */
export function splitHttpUrls(text: string): HttpUrlSpan[] {
    const spans: HttpUrlSpan[] = [];
    let last = 0;
    for (const match of text.matchAll(httpUrlPattern)) {
        const index = match.index ?? 0;
        const url = match[0].replace(/[.,;:]+$/, "");
        if (!/^https?:\/\//i.test(url)) {
            continue;
        }
        if (index > last) {
            spans.push({ kind: "text", text: text.slice(last, index) });
        }
        spans.push({ kind: "url", text: url, url });
        last = index + url.length;
    }
    if (last < text.length) {
        spans.push({ kind: "text", text: text.slice(last) });
    }
    if (spans.length === 0) {
        return [{ kind: "text", text }];
    }
    return spans;
}
