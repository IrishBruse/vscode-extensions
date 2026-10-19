import type { AcpRpcNdjsonSink } from "../../acp/ports/rpcNdjsonSink";
import type { AcpSessionHostRuntime } from "../../acp/session/acpSessionBridge";
import { createNodeAcpHostFilesystem } from "./nodeHostFilesystem";

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
    return {
        hostFilesystem: createNodeAcpHostFilesystem(),
        rpcNdjsonSink: options.rpcNdjsonSink,
        getWorkspaceRoot: () => root,
    };
}
