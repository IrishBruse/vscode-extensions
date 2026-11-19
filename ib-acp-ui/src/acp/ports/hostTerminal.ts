import type * as acp from "@agentclientprotocol/sdk";

/** Client-hosted terminal operations for ACP `terminal/*` RPC methods. */
export interface AcpHostTerminal {
    createTerminal(params: acp.CreateTerminalRequest): Promise<acp.CreateTerminalResponse>;
    terminalOutput(params: acp.TerminalOutputRequest): Promise<acp.TerminalOutputResponse>;
    waitForTerminalExit(
        params: acp.WaitForTerminalExitRequest,
    ): Promise<acp.WaitForTerminalExitResponse>;
    killTerminal(params: acp.KillTerminalRequest): Promise<acp.KillTerminalResponse | void>;
    releaseTerminal(
        params: acp.ReleaseTerminalRequest,
    ): Promise<acp.ReleaseTerminalResponse | void>;
    /** Tear down every terminal owned by this host (for example when the agent connection closes). */
    dispose(): void;
}
