export type AcpUiSessionConnectionStatus = "connected" | "disconnected" | "connecting";

type SessionConnectionRow = {
    status: AcpUiSessionConnectionStatus;
    message?: string;
};

const connectionBySessionId = new Map<string, SessionConnectionRow>();

export function setAcpUiSessionConnection(
    sessionId: string,
    status: AcpUiSessionConnectionStatus,
    message?: string,
): void {
    connectionBySessionId.set(sessionId, {
        status,
        ...(message !== undefined && message.trim().length > 0 ? { message: message.trim() } : {}),
    });
}

export function getAcpUiSessionConnection(sessionId: string): SessionConnectionRow | undefined {
    return connectionBySessionId.get(sessionId);
}

export function clearAcpUiSessionConnection(sessionId: string): void {
    connectionBySessionId.delete(sessionId);
}
