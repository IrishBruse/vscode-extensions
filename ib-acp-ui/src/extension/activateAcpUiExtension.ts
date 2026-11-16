import { type ExtensionContext, type OutputChannel, window } from "vscode";
import {
    buildAcpClientInfoFromPackage,
    configureAcpClientInfo,
} from "../acp/infrastructure/acpAgentProcess";
import { NullAcpRpcNdjsonSink } from "../acp/ports/rpcNdjsonSink";
import { registerCommandIB } from "../utils/vscode";
import { showAcpRpcLogInActiveSession } from "./acpUiCustomEditorProvider";

export type AcpUiExtensionActivation = {
    /** Shared between stdio taps and optional UI hosts that embed a bridge. */
    rpcNdjsonSink: NullAcpRpcNdjsonSink;
    outputChannel: OutputChannel;
};

/**
 * Registers the ACP RPC output channel and related commands.
 */
export function activateAcpUiExtension(context: ExtensionContext): AcpUiExtensionActivation {
    configureAcpClientInfo(
        buildAcpClientInfoFromPackage(
            context.extension.packageJSON as {
                name?: string;
                version?: string;
                displayName?: string;
            },
        ),
    );
    const outputChannel = window.createOutputChannel("ACP UI");
    const rpcNdjsonSink = new NullAcpRpcNdjsonSink();
    context.subscriptions.push(outputChannel);
    registerCommandIB(
        "ib-acp-ui.showAcpRpcLog",
        () => {
            showAcpRpcLogInActiveSession();
        },
        context,
    );
    return { rpcNdjsonSink, outputChannel };
}
