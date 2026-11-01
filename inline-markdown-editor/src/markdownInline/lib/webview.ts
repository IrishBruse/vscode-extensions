import type { DiffPaint } from "./diff/lineChanges";
import { mountInlineEditor } from "./editor";
import { installWebviewThemeSync, webviewThemeTargets } from "./webviewTheme";
import "./styles/editor.css";

interface VsCodeApi {
    postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

interface BootState {
    content: string;
    documentVersion: number;
    documentUrl: string;
    readonly: boolean;
    skillFrontMatter?: boolean;
    scrollSync?: boolean;
    diff?: DiffPaint;
}

function isBootState(value: unknown): value is BootState {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return (
        typeof record.content === "string" &&
        typeof record.documentVersion === "number" &&
        typeof record.readonly === "boolean" &&
        typeof record.documentUrl === "string"
    );
}

function isColumnSpan(value: unknown): boolean {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return (
        typeof record.line === "number" &&
        typeof record.startColumn === "number" &&
        typeof record.endColumn === "number"
    );
}

function isDiffPaint(value: unknown): value is DiffPaint {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return (
        (record.kind === "added" || record.kind === "removed") &&
        Array.isArray(record.lines) &&
        record.lines.every((line) => typeof line === "number") &&
        Array.isArray(record.inner) &&
        record.inner.every((span) => isColumnSpan(span)) &&
        Array.isArray(record.removedBlocks) &&
        record.removedBlocks.every((block) => {
            if (typeof block !== "object" || block === null) {
                return false;
            }
            const entry = block as Record<string, unknown>;
            return typeof entry.beforeLine === "number" && typeof entry.text === "string";
        })
    );
}

function readBootState(): BootState {
    const meta = document.querySelector("#inline-md-state");
    if (!(meta instanceof HTMLMetaElement)) {
        throw new Error("Missing inline markdown state");
    }
    const parsed: unknown = JSON.parse(decodeURIComponent(meta.content));
    if (!isBootState(parsed)) {
        throw new Error("Invalid inline markdown state");
    }
    return parsed;
}

function readMessageSecret(): string {
    const meta = document.querySelector('meta[name="inline-md-message-secret"]');
    if (!(meta instanceof HTMLMetaElement) || meta.content.length === 0) {
        throw new Error("Missing inline markdown message secret");
    }
    return meta.content;
}

const vscode = acquireVsCodeApi();
const messageSecret = readMessageSecret();
const boot = readBootState();
const parent = document.querySelector("#editor");
if (!(parent instanceof HTMLElement)) {
    throw new Error("Missing #editor");
}

const editor = mountInlineEditor(parent, {
    text: boot.content,
    documentUrl: boot.documentUrl,
    readOnly: boot.readonly,
    skillFrontMatter: boot.skillFrontMatter === true,
    onEdit(edit) {
        vscode.postMessage({
            type: "edit",
            messageSecret,
            start: edit.start,
            endExclusive: edit.endExclusive,
            text: edit.text,
        });
    },
    onHistory(command) {
        vscode.postMessage({
            type: "history",
            messageSecret,
            command,
        });
    },
    onLink(href) {
        vscode.postMessage({
            type: "openLink",
            messageSecret,
            href,
        });
    },
    onOpenMermaidPreview(openLine) {
        vscode.postMessage({
            type: "openMermaidPreview",
            messageSecret,
            openLine,
        });
    },
    onVisibleLine: boot.scrollSync
        ? (line) => {
              vscode.postMessage({
                  type: "scroll",
                  messageSecret,
                  line,
              });
          }
        : undefined,
    diff: boot.diff,
});

const stopWebviewThemeSync = installWebviewThemeSync(() => webviewThemeTargets(parent));

vscode.postMessage({
    type: "ready",
    messageSecret,
    documentVersion: boot.documentVersion,
});

window.addEventListener("beforeunload", () => {
    stopWebviewThemeSync();
});

window.addEventListener("message", (event: MessageEvent) => {
    const message: unknown = event.data;
    if (typeof message !== "object" || message === null) {
        return;
    }
    const record = message as Record<string, unknown>;
    if (record.messageSecret !== messageSecret) {
        return;
    }
    if (record.type === "update" && typeof record.content === "string") {
        editor.setDocument(record.content);
        if (isDiffPaint(record.diff)) {
            editor.setDiff(record.diff);
        }
    }
    if (record.type === "diff" && isDiffPaint(record.diff)) {
        editor.setDiff(record.diff);
    }
    if (record.type === "reveal" && typeof record.line === "number") {
        editor.revealLine(record.line);
    }
});
