export function headingSlug(title: string): string {
    return title
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

class HeadingSlugger {
    readonly #counts = new Map<string, number>();

    slug(title: string): string {
        const base = headingSlug(title);
        const seen = this.#counts.get(base) ?? 0;
        this.#counts.set(base, seen + 1);
        if (seen === 0) {
            return base;
        }
        return `${base}-${seen}`;
    }
}

function stripTrailingHashes(title: string): string {
    return title.replace(/\s+#+\s*$/, "").trim();
}

export function lineForHeadingFragment(markdown: string, fragment: string): number | undefined {
    let wanted: string;
    try {
        wanted = decodeURIComponent(fragment).trim().toLowerCase();
    } catch {
        wanted = fragment.trim().toLowerCase();
    }
    if (wanted.length === 0) {
        return undefined;
    }
    const slugger = new HeadingSlugger();
    const lines = markdown.split(/\r\n|\r|\n/);
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index] ?? "";
        const match = /^(#{1,6})\s+(.*)$/.exec(line);
        if (!match) {
            continue;
        }
        const title = stripTrailingHashes(match[2] ?? "");
        if (title.length === 0) {
            continue;
        }
        if (slugger.slug(title) === wanted) {
            return index;
        }
    }
    return undefined;
}

export function resolveMarkdownLink(
    href: string,
    documentUrl: string,
): { sameDocument: boolean; fragment?: string } | undefined {
    const trimmed = href.trim();
    if (!trimmed || /^https?:\/\//i.test(trimmed)) {
        return undefined;
    }
    try {
        const resolved = new URL(trimmed, documentUrl);
        if (resolved.protocol === "javascript:" || resolved.protocol === "vbscript:") {
            return undefined;
        }
        const base = new URL(documentUrl);
        const sameDocument =
            resolved.origin === base.origin &&
            resolved.pathname === base.pathname &&
            resolved.search === base.search;
        const fragment = resolved.hash.length > 1 ? resolved.hash.slice(1) : undefined;
        return { sameDocument, fragment };
    } catch {
        return undefined;
    }
}

export function tryRevealHeadingFragment(
    href: string,
    markdown: string,
    documentUrl: string,
    revealLine: (line: number) => void,
): boolean {
    const resolved = resolveMarkdownLink(href, documentUrl);
    if (!resolved?.sameDocument || !resolved.fragment) {
        return false;
    }
    if (/^L(\d+)(?:,(\d+))?$/.test(resolved.fragment)) {
        return false;
    }
    const line = lineForHeadingFragment(markdown, resolved.fragment);
    if (line === undefined) {
        return false;
    }
    revealLine(line);
    return true;
}
