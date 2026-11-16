import type { AcpAgentSpawnConfig } from "../acp/domain/agentSpawnConfig";
import { isCursorAcpAgent } from "../acp/domain/agentSpawnConfig";

/** Matches the auto-generated title of a chat that has not been used yet. */
export const placeholderSessionTitlePattern = /^New .* chat$/;

const maxSessionTitleLength = 80;

/** True when the stored title is still the placeholder from a new chat. */
export function isPlaceholderSessionTitle(title: string): boolean {
    const trimmed = title.trim();
    return trimmed.length === 0 || placeholderSessionTitlePattern.test(trimmed);
}

/**
 * A `.acp` save that still has `New Cursor chat` must not replace a title the agent already sent.
 */
export function shouldPublishSessionFileTitle(displayedTitle: string, fileTitle: string): boolean {
    if (isPlaceholderSessionTitle(fileTitle) && !isPlaceholderSessionTitle(displayedTitle)) {
        return false;
    }
    return true;
}

/**
 * Keeps an agent title in the session index when a file rescan still sees the new-chat placeholder.
 */
export function titleAfterSessionFileReload(
    memoryTitle: string | undefined,
    diskTitle: string,
): string {
    if (
        memoryTitle !== undefined &&
        !isPlaceholderSessionTitle(memoryTitle) &&
        isPlaceholderSessionTitle(diskTitle)
    ) {
        return memoryTitle;
    }
    return diskTitle;
}

/**
 * True when the first prompt may supply the title because the agent is unlikely to send
 * `session_info_update` (non-Cursor agents only; Cursor titles come from the agent).
 */
export function shouldDeriveSessionTitleFromPrompt(
    currentTitle: string,
    agentConfig: AcpAgentSpawnConfig | undefined,
): boolean {
    if (!isPlaceholderSessionTitle(currentTitle)) {
        return false;
    }
    return agentConfig === undefined || !isCursorAcpAgent(agentConfig);
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
