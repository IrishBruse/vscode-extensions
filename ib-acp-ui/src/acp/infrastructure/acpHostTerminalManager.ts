import { type ChildProcess, spawn } from "node:child_process";
import type * as acp from "@agentclientprotocol/sdk";
import type { AcpHostTerminal } from "../ports/hostTerminal";
import { defaultTerminalOutputByteLimit, truncateTerminalOutput } from "./terminalOutputBuffer";

export type AcpHostTerminalManagerHooks = {
    onOutput?: (chunk: string) => void;
};

export type AcpHostTerminalManagerOptions = {
    getWorkspaceRoot: () => string | undefined;
};

type ManagedTerminal = {
    sessionId: string;
    child: ChildProcess;
    output: string;
    truncated: boolean;
    outputByteLimit: number;
    exitStatus: acp.TerminalExitStatus | null;
    exitPromise: Promise<acp.WaitForTerminalExitResponse>;
    released: boolean;
    hooks?: AcpHostTerminalManagerHooks;
};

function mergeEnv(
    base: NodeJS.ProcessEnv,
    extra: acp.CreateTerminalRequest["env"],
): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...base };
    for (const variable of extra ?? []) {
        env[variable.name] = variable.value;
    }
    return env;
}

function exitStatusFromClose(
    code: number | null,
    signal: NodeJS.Signals | null,
): acp.TerminalExitStatus {
    return {
        exitCode: code,
        signal: signal ?? null,
    };
}

export class AcpHostTerminalManager implements AcpHostTerminal {
    private readonly terminals = new Map<string, ManagedTerminal>();
    private nextTerminalId = 1;

    constructor(private readonly options: AcpHostTerminalManagerOptions) {}

    createTerminal(
        params: acp.CreateTerminalRequest,
        hooks?: AcpHostTerminalManagerHooks,
    ): Promise<acp.CreateTerminalResponse> {
        const terminalId = `term_${this.nextTerminalId++}`;
        const args = params.args ?? [];
        const outputByteLimit = params.outputByteLimit ?? defaultTerminalOutputByteLimit;
        const cwd = params.cwd ?? this.options.getWorkspaceRoot() ?? process.cwd();
        const child = spawn(params.command, args, {
            cwd,
            env: mergeEnv(process.env, params.env),
            stdio: ["ignore", "pipe", "pipe"],
        });

        let resolveExit!: (value: acp.WaitForTerminalExitResponse) => void;
        const exitPromise = new Promise<acp.WaitForTerminalExitResponse>((resolve) => {
            resolveExit = resolve;
        });

        const managed: ManagedTerminal = {
            sessionId: params.sessionId,
            child,
            output: "",
            truncated: false,
            outputByteLimit,
            exitStatus: null,
            exitPromise,
            released: false,
            hooks,
        };

        const appendOutput = (chunk: string): void => {
            managed.output += chunk;
            const next = truncateTerminalOutput(managed.output, outputByteLimit);
            managed.output = next.output;
            managed.truncated = managed.truncated || next.truncated;
            hooks?.onOutput?.(chunk);
        };

        child.stdout?.setEncoding("utf8");
        child.stderr?.setEncoding("utf8");
        child.stdout?.on("data", (chunk: string) => appendOutput(chunk));
        child.stderr?.on("data", (chunk: string) => appendOutput(chunk));

        child.on("close", (code, signal) => {
            const status = exitStatusFromClose(code, signal);
            managed.exitStatus = status;
            resolveExit({
                exitCode: status.exitCode,
                signal: status.signal,
            });
        });

        child.on("error", (err) => {
            appendOutput(`${err.message}\n`);
        });

        this.terminals.set(terminalId, managed);
        return Promise.resolve({ terminalId });
    }

    terminalOutput(params: acp.TerminalOutputRequest): Promise<acp.TerminalOutputResponse> {
        const managed = this.requireTerminal(params.terminalId, params.sessionId);
        return Promise.resolve({
            output: managed.output,
            truncated: managed.truncated,
            ...(managed.exitStatus !== null ? { exitStatus: managed.exitStatus } : {}),
        });
    }

    waitForTerminalExit(
        params: acp.WaitForTerminalExitRequest,
    ): Promise<acp.WaitForTerminalExitResponse> {
        const managed = this.requireTerminal(params.terminalId, params.sessionId);
        if (managed.exitStatus !== null) {
            return Promise.resolve({
                exitCode: managed.exitStatus.exitCode,
                signal: managed.exitStatus.signal,
            });
        }
        return managed.exitPromise;
    }

    killTerminal(params: acp.KillTerminalRequest): Promise<acp.KillTerminalResponse | void> {
        const managed = this.requireTerminal(params.terminalId, params.sessionId);
        if (managed.exitStatus === null && !managed.child.killed) {
            managed.child.kill();
        }
        return Promise.resolve({});
    }

    releaseTerminal(
        params: acp.ReleaseTerminalRequest,
    ): Promise<acp.ReleaseTerminalResponse | void> {
        const managed = this.terminals.get(params.terminalId);
        if (managed === undefined) {
            return Promise.resolve({});
        }
        if (managed.sessionId !== params.sessionId) {
            throw new Error(
                `Terminal "${params.terminalId}" does not belong to session "${params.sessionId}".`,
            );
        }
        if (managed.exitStatus === null && !managed.child.killed) {
            managed.child.kill();
        }
        managed.released = true;
        this.terminals.delete(params.terminalId);
        return Promise.resolve({});
    }

    dispose(): void {
        for (const [terminalId, managed] of this.terminals) {
            if (managed.exitStatus === null && !managed.child.killed) {
                managed.child.kill();
            }
            this.terminals.delete(terminalId);
        }
    }

    private requireTerminal(terminalId: string, sessionId: string): ManagedTerminal {
        const managed = this.terminals.get(terminalId);
        if (managed === undefined) {
            throw new Error(`Unknown ACP terminal "${terminalId}".`);
        }
        if (managed.sessionId !== sessionId) {
            throw new Error(`Terminal "${terminalId}" does not belong to session "${sessionId}".`);
        }
        if (managed.released) {
            throw new Error(`ACP terminal "${terminalId}" was released.`);
        }
        return managed;
    }
}

/** Factory for the shared child-process terminal manager. */
export function createAcpHostTerminalManager(
    options: AcpHostTerminalManagerOptions,
): AcpHostTerminalManager {
    return new AcpHostTerminalManager(options);
}
