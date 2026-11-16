/** Matches the auto-generated title of a chat that has not been used yet. */
export const placeholderSessionTitlePattern = /^New .* chat$/;

const maxSessionTitleLength = 80;

/** True when the stored title is still the placeholder from a new chat. */
export function isPlaceholderSessionTitle(title: string): boolean {
    const trimmed = title.trim();
    return trimmed.length === 0 || placeholderSessionTitlePattern.test(trimmed);
}

/**
 * Derives a short human-readable chat title from the first line of a user prompt.
 * Used when the agent does not send `session_info_update`.
 */
export function sessionTitleFromPrompt(body: string): string {
    const firstLine = body.replace(/\r\n/g, "\n").split("\n")[0] ?? "";
    const collapsed = firstLine.replace(/\s+/g, " ").trim();
    if (collapsed.length === 0) {
        return "";
    }
    if (collapsed.length <= maxSessionTitleLength) {
        return collapsed;
    }
    return `${collapsed.slice(0, maxSessionTitleLength - 1).trimEnd()}…`;
}
