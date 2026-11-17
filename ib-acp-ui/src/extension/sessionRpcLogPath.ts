import { type ExtensionContext, Uri } from "vscode";
import { resolveSessionsDirectoryUri } from "./acpUiSessionJsonl";

export const ACP_UI_SESSION_RPC_LOG_SUFFIX = ".rpc.ndjson";

/** File name for one session's wire-protocol log: `<sessionId>.rpc.ndjson`. */
export function sessionRpcLogFileNameForId(sessionId: string): string {
    return `${sessionId.trim()}${ACP_UI_SESSION_RPC_LOG_SUFFIX}`;
}

/** Resolves `chats/<sessionId>.rpc.ndjson` beside the `.acp` session file. */
export function sessionRpcLogUriForId(context: ExtensionContext, sessionId: string): Uri {
    return Uri.joinPath(
        resolveSessionsDirectoryUri(context),
        sessionRpcLogFileNameForId(sessionId),
    );
}
