import { workspace } from "vscode";
import { readAutoApproveWebFetchAndSearch } from "../../acp/config/autoApproveWebToolsSetting";
import { loadCursorMcpReport } from "../../acp/mcp/vscodeMcpServers";
import type { AcpRpcNdjsonSink } from "../../acp/ports/rpcNdjsonSink";
import type { AcpSessionHostRuntime } from "../../acp/session/acpSessionBridge";
import { createVscodeAcpHostFilesystem, getFirstWorkspaceFolderPath } from "./vscodeHostFilesystem";
import { createVscodeAcpHostTerminal } from "./vscodeAcpHostTerminal";

/** Production wiring for `AcpSessionHostRuntime`: `workspace.fs`, first-folder root, and the RPC sink. */
export function createDefaultAcpSessionHostRuntime(
    rpcNdjsonSink: AcpRpcNdjsonSink,
): AcpSessionHostRuntime {
    const getWorkspaceRoot = () => getFirstWorkspaceFolderPath(workspace.workspaceFolders);
    return {
        hostFilesystem: createVscodeAcpHostFilesystem(),
        hostTerminal: createVscodeAcpHostTerminal({ getWorkspaceRoot }),
        rpcNdjsonSink,
        getWorkspaceRoot,
        autoApproveWebTools: readAutoApproveWebFetchAndSearch,
        loadMcpServers: (capabilities) => loadCursorMcpReport(capabilities),
    };
}
