/**
 * Editor-tab status marks from the Cursor agent title replacement.
 * Generating cycles the monochrome braille frames. Other states use one static mark.
 */
export const agentTabGeneratingFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"] as const;

/** Cursor agent title replacement advances the generating frame on this interval. */
export const agentTabTitleFrameMs = 200;

export type AgentTabIndicator =
    | "generating"
    | "planning"
    | "shell-running"
    | "reviewing"
    | "waiting-for-user"
    | "waiting-for-confirmation"
    | "queued"
    | "loading"
    | "reconnecting"
    | "transfer";

const agentTabIndicators = new Set<string>([
    "generating",
    "planning",
    "shell-running",
    "reviewing",
    "waiting-for-user",
    "waiting-for-confirmation",
    "queued",
    "loading",
    "reconnecting",
    "transfer",
]);

export function isAgentTabIndicator(value: unknown): value is AgentTabIndicator {
    return typeof value === "string" && agentTabIndicators.has(value);
}

export function agentTabMark(indicator: AgentTabIndicator, frameIndex: number): string {
    switch (indicator) {
        case "transfer":
            return "↑";
        case "loading":
            return "…";
        case "reconnecting":
            return "↻";
        case "shell-running":
            return "❯";
        case "planning":
            return "◇";
        case "generating": {
            const length = agentTabGeneratingFrames.length;
            const index = ((frameIndex % length) + length) % length;
            return agentTabGeneratingFrames[index] ?? "";
        }
        case "queued":
            return "≡";
        case "waiting-for-user":
            return "?";
        case "waiting-for-confirmation":
            return "!";
        case "reviewing":
            return "✎";
    }
}

/** Chat name plus the current monochrome mark. Idle keeps the name alone. */
export function formatAgentTabTitle(
    chatName: string,
    indicator: AgentTabIndicator | null,
    frameIndex = 0,
): string {
    const name = chatName.trim();
    if (indicator === null) {
        return name;
    }
    const mark = agentTabMark(indicator, frameIndex);
    if (mark.length === 0 || name.length === 0) {
        return name.length > 0 ? name : mark;
    }
    return `${name} ${mark}`;
}

export function agentTabIndicatorForTurn(turn: {
    promptInFlight: boolean;
    activityLabel: string | null;
    waitingForUser: boolean;
    waitingForConfirmation: boolean;
}): AgentTabIndicator | null {
    if (turn.waitingForUser) {
        return "waiting-for-user";
    }
    if (turn.waitingForConfirmation) {
        return "waiting-for-confirmation";
    }
    if (!turn.promptInFlight) {
        return null;
    }
    if (turn.activityLabel === "Running…") {
        return "shell-running";
    }
    if (turn.activityLabel === "Writing…") {
        return "reviewing";
    }
    return "generating";
}
