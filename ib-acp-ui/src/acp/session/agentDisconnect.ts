/** Details from an agent subprocess exit event. */
export type AgentProcessExitDetails = {
    code: number | null;
    signal: NodeJS.Signals | string | null;
    stderrTail?: string;
};

/** Formats a user-facing message when the ACP agent process stops. */
export function formatAgentProcessExitMessage(
    agentName: string,
    details: AgentProcessExitDetails,
): string {
    const lines = [`ACP agent "${agentName}" stopped.`];
    if (details.code !== null) {
        lines.push(`Exit code: ${details.code}.`);
    } else if (details.signal !== null && details.signal.length > 0) {
        lines.push(`Signal: ${details.signal}.`);
    }
    const stderr = details.stderrTail?.trim();
    if (stderr !== undefined && stderr.length > 0) {
        lines.push(stderr);
    }
    return lines.join("\n");
}

/** True when a thrown/reported error means the ACP stdio connection is gone. */
export function isAcpDisconnectError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
        lower.includes("acp connection closed") ||
        lower.includes("active session disposed") ||
        message === "Agent not started"
    );
}

/** Rewrites low-level connection errors into clearer text. */
export function formatAcpConnectionErrorMessage(agentName: string, detail: string): string {
    if (detail === "Agent session not connected.") {
        return `ACP agent "${agentName}" is not connected. Send a message to reconnect, or use /reset to start a new session.`;
    }
    if (isAcpDisconnectError(detail)) {
        return `Lost connection to ACP agent "${agentName}". The agent process may have stopped.`;
    }
    return detail;
}
