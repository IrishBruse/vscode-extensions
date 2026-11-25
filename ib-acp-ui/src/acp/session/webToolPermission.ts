import type * as acp from "@agentclientprotocol/sdk";

function textField(value: unknown): string {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function rawToolName(raw: unknown): string {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return "";
    }
    const record = Object.fromEntries(Object.entries(raw));
    return [record.name, record.toolName, record._toolName].map(textField).join(" ");
}

/** True for a web fetch or web search permission. File search and grep stay out. */
export function isWebFetchOrSearchTool(toolCall: acp.ToolCallUpdate): boolean {
    const kind = textField(toolCall.kind).replace(/[_-]+/g, " ");
    const title = textField(toolCall.title);
    const name = textField(toolCall.name).replace(/[_-]+/g, " ");
    const rawName = rawToolName(toolCall.rawInput).replace(/[_-]+/g, " ");
    const label = `${kind} ${title} ${name} ${rawName}`;
    if (kind === "fetch" || kind === "web fetch" || kind === "web search") {
        return true;
    }
    if (/\bweb\s*fetch\b/.test(label) || /\bwebfetch\b/.test(label)) {
        return true;
    }
    if (/\bweb\s*search\b/.test(label) || /\bwebsearch\b/.test(label)) {
        return true;
    }
    return /^fetch\b/.test(title);
}

function optionLooksLikeAllowOnce(option: acp.PermissionOption): boolean {
    if (option.kind === "allow_once") {
        return true;
    }
    const id = option.optionId.trim().toLowerCase();
    const name = option.name.trim().toLowerCase();
    const allow = id.includes("allow") || name.includes("allow");
    const always = id.includes("always") || name.includes("always");
    return allow && !always && !id.includes("reject") && !name.includes("reject");
}

function optionLooksLikeAllowAlways(option: acp.PermissionOption): boolean {
    if (option.kind === "allow_always") {
        return true;
    }
    const id = option.optionId.trim().toLowerCase();
    const name = option.name.trim().toLowerCase();
    return (
        ((id.includes("allow") && id.includes("always")) || name === "allow always") &&
        !id.includes("reject") &&
        !name.includes("reject")
    );
}

/** Allow option for an auto-approved web tool. Prefers Allow once. */
export function autoApproveWebToolOption(
    request: acp.RequestPermissionRequest,
): acp.PermissionOption | undefined {
    if (!isWebFetchOrSearchTool(request.toolCall)) {
        return undefined;
    }
    return (
        request.options.find(optionLooksLikeAllowOnce) ??
        request.options.find(optionLooksLikeAllowAlways)
    );
}
