import { EventEmitter, window, type Pseudoterminal, type Terminal, Disposable } from "vscode";
import type { AcpHostTerminal } from "../../acp/ports/hostTerminal";
import {
    createAcpHostTerminalManager,
    type AcpHostTerminalManagerOptions,
} from "../../acp/infrastructure/acpHostTerminalManager";

type VscodeTerminalAttachment = {
    terminal: Terminal;
    disposables: Disposable[];
};

/**
 * VS Code–backed ACP terminals: child-process capture for the protocol plus a
 * {@link Pseudoterminal} mirror in the integrated terminal panel.
 */
export function createVscodeAcpHostTerminal(
    options: AcpHostTerminalManagerOptions,
): AcpHostTerminal {
    const manager = createAcpHostTerminalManager(options);
    const visualTerminals = new Map<string, VscodeTerminalAttachment>();

    const toPtyLines = (text: string): string => text.replace(/\n/g, "\r\n");

    return {
        async createTerminal(params) {
            const writeEmitter = new EventEmitter<string>();
            const pty: Pseudoterminal = {
                onDidWrite: writeEmitter.event,
                open: () => {
                    const line = [params.command, ...(params.args ?? [])].join(" ");
                    writeEmitter.fire(toPtyLines(`$ ${line}\r\n`));
                },
                close: () => {},
            };
            const vscodeTerminal = window.createTerminal({
                name: `ACP: ${params.command}`,
                pty,
            });
            vscodeTerminal.show(true);
            const attachment: VscodeTerminalAttachment = {
                terminal: vscodeTerminal,
                disposables: [writeEmitter],
            };
            const response = await manager.createTerminal(params, {
                onOutput: (chunk) => writeEmitter.fire(toPtyLines(chunk)),
            });
            visualTerminals.set(response.terminalId, attachment);
            return response;
        },
        terminalOutput: (params) => manager.terminalOutput(params),
        waitForTerminalExit: (params) => manager.waitForTerminalExit(params),
        killTerminal: (params) => manager.killTerminal(params),
        releaseTerminal: async (params) => {
            const attachment = visualTerminals.get(params.terminalId);
            if (attachment !== undefined) {
                for (const disposable of attachment.disposables) {
                    disposable.dispose();
                }
                attachment.terminal.dispose();
                visualTerminals.delete(params.terminalId);
            }
            await manager.releaseTerminal(params);
        },
        dispose() {
            for (const attachment of visualTerminals.values()) {
                for (const disposable of attachment.disposables) {
                    disposable.dispose();
                }
                attachment.terminal.dispose();
            }
            visualTerminals.clear();
            manager.dispose();
        },
    };
}
