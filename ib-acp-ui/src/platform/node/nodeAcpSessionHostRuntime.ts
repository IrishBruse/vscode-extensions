import type { AcpRpcNdjsonSink } from "../../acp/ports/rpcNdjsonSink";
import type { AcpSessionHostRuntime } from "../../acp/session/acpSessionBridge";
import { createNodeAcpHostFilesystem } from "./nodeHostFilesystem";
import { createNodeAcpHostTerminal } from "./nodeAcpHostTerminal";

export type NodeAcpSessionHostOptions = {
    rpcNdjsonSink: AcpRpcNdjsonSink;
    /** Used for agent `cwd` and `session/new` metadata; defaults to `process.cwd()`. */
    workspaceRoot?: string;
};

/**
 * Non-VS Code wiring for {@link AcpSessionBridge}: real filesystem and an explicit workspace root.
 */
export function createNodeAcpSessionHostRuntime(
    options: NodeAcpSessionHostOptions,
): AcpSessionHostRuntime {
    const root = options.workspaceRoot ?? process.cwd();
    const getWorkspaceRoot = () => root;
    return {
        hostFilesystem: createNodeAcpHostFilesystem(),
        hostTerminal: createNodeAcpHostTerminal({ getWorkspaceRoot }),
        rpcNdjsonSink: options.rpcNdjsonSink,
        getWorkspaceRoot,
    };
}
