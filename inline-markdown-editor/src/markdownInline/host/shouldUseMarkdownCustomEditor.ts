import { commands, Uri, ViewColumn, window, workspace } from "vscode";

const DIRECT_EDIT_SCHEMES = new Set(["file", "untitled", "vscode-remote", "vscode-vfs"]);

export function isDirectMarkdownEditUri(uri: Uri): boolean {
    return DIRECT_EDIT_SCHEMES.has(uri.scheme);
}

function sameResource(left: Uri, right: Uri): boolean {
    return (
        left.scheme === right.scheme &&
        left.path === right.path &&
        (left.query ?? "") === (right.query ?? "")
    );
}

function isUriLike(value: unknown): value is Uri {
    return (
        !!value &&
        typeof value === "object" &&
        typeof (value as Uri).scheme === "string" &&
        typeof (value as Uri).path === "string"
    );
}

const DIFF_URI_KEYS = ["original", "modified", "base", "input1", "input2", "result"] as const;

function collectDiffUris(input: unknown, into: Uri[]): void {
    if (!input || typeof input !== "object") {
        return;
    }
    const record = input as Record<string, unknown>;
    for (const key of DIFF_URI_KEYS) {
        if (isUriLike(record[key])) {
            into.push(record[key]);
        }
    }
    for (const listKey of ["resources", "textDiffs"] as const) {
        if (!Array.isArray(record[listKey])) {
            continue;
        }
        for (const resource of record[listKey]) {
            collectDiffUris(resource, into);
        }
    }
}

function documentText(uri: Uri): string | undefined {
    for (const document of workspace.textDocuments ?? []) {
        if (sameResource(document.uri, uri)) {
            return document.getText();
        }
    }
    return undefined;
}

function diffSidesHaveChanges(uri: Uri, sides: Uri[]): boolean {
    const others = sides.filter((side) => !sameResource(side, uri));
    if (others.length === 0) {
        return true;
    }
    const ownText = documentText(uri);
    for (const other of others) {
        const otherText = documentText(other);
        if (ownText === undefined || otherText === undefined) {
            return true;
        }
        if (ownText !== otherText) {
            return true;
        }
    }
    return false;
}

export function isMarkdownUriInDiffTab(uri: Uri): boolean {
    for (const group of window.tabGroups.all) {
        for (const tab of group.tabs) {
            const sides: Uri[] = [];
            collectDiffUris(tab.input, sides);
            if (sides.some((side) => sameResource(side, uri))) {
                return true;
            }
        }
    }
    return false;
}

function isMarkdownUriInChangedDiffTab(uri: Uri): boolean {
    for (const group of window.tabGroups.all) {
        for (const tab of group.tabs) {
            const sides: Uri[] = [];
            collectDiffUris(tab.input, sides);
            if (!sides.some((side) => sameResource(side, uri))) {
                continue;
            }
            if (diffSidesHaveChanges(uri, sides)) {
                return true;
            }
        }
    }
    return false;
}

export function shouldUseMarkdownCustomEditor(uri: Uri): boolean {
    return isDirectMarkdownEditUri(uri) && !isMarkdownUriInChangedDiffTab(uri);
}

const rawOpenInFlight = new Set<string>();

export async function openMarkdownWithRawEditor(uri: Uri, viewColumn?: ViewColumn): Promise<void> {
    const key = uri.path;
    if (rawOpenInFlight.has(key)) {
        return;
    }
    rawOpenInFlight.add(key);
    try {
        await commands.executeCommand(
            "vscode.openWith",
            uri,
            "default",
            viewColumn === undefined ? undefined : { viewColumn },
        );
    } finally {
        rawOpenInFlight.delete(key);
    }
}
