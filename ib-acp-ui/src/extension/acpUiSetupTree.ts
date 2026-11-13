import type { AcpAgentSpawnConfig } from "../acp/domain/agentSpawnConfig";

export const cmdAddAcpClient = "ib-acp-ui.addAcpClient";
export const cmdSelectActiveAgent = "ib-acp-ui.selectActiveAgent";

/** Splits an arguments input box into spawn args. */
export function parseClientArgsInput(value: string): string[] {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return [];
    }
    return trimmed.split(/\s+/);
}

/** Inserts or replaces a manual client by display name. */
export function manualClientsAfterAdd(
    current: AcpAgentSpawnConfig[],
    next: AcpAgentSpawnConfig,
): AcpAgentSpawnConfig[] {
    return [...current.filter((entry) => entry.name !== next.name), next];
}

/** Updates the command and args of one manual client and keeps its other fields. */
export function manualClientsAfterEdit(
    current: AcpAgentSpawnConfig[],
    name: string,
    patch: { command: string; args: string[] },
): AcpAgentSpawnConfig[] {
    return current.map((entry) =>
        entry.name === name ? { ...entry, command: patch.command, args: patch.args } : entry,
    );
}

/** Drops a manual client by display name. */
export function manualClientsAfterRemove(
    current: AcpAgentSpawnConfig[],
    name: string,
): AcpAgentSpawnConfig[] {
    return current.filter((entry) => entry.name !== name);
}
