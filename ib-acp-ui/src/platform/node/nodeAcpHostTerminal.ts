import type { AcpHostTerminal } from "../../acp/ports/hostTerminal";
import {
    createAcpHostTerminalManager,
    type AcpHostTerminalManagerOptions,
} from "../../acp/infrastructure/acpHostTerminalManager";

/** Node-only ACP terminal host for the playground (no VS Code panel). */
export function createNodeAcpHostTerminal(options: AcpHostTerminalManagerOptions): AcpHostTerminal {
    return createAcpHostTerminalManager(options);
}
