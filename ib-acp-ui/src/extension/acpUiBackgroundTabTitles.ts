import {
    ConfigurationTarget,
    type ExtensionContext,
    TabInputCustom,
    TabInputText,
    type Tab,
    type Uri,
    window,
    workspace,
} from "vscode";
import { acpUiCustomEditorViewType } from "./acpUiCustomEditorProvider";
import {
    customLabelPatternsEqual,
    customLabelTemplate,
    mergeOwnedCustomLabelPatterns,
} from "./acpUiEditorTabLabel";
import { readSessionTitleAtUri } from "./acpUiSessionJsonl";

const ownedEditorLabelPatternsKey = "acpUi.ownedEditorLabelPatterns";

function acpTabUri(tab: Tab): Uri | undefined {
    const input = tab.input;
    if (input instanceof TabInputCustom && input.viewType === acpUiCustomEditorViewType) {
        return input.uri;
    }
    if (input instanceof TabInputText && input.uri.path.endsWith(".acp")) {
        return input.uri;
    }
    return undefined;
}

function openAcpTabUris(): Uri[] {
    const byPath = new Map<string, Uri>();
    for (const group of window.tabGroups.all) {
        for (const tab of group.tabs) {
            const uri = acpTabUri(tab);
            if (uri !== undefined) {
                byPath.set(uri.toString(), uri);
            }
        }
    }
    return [...byPath.values()];
}

function ownedPatternsFromState(context: ExtensionContext): string[] {
    const stored = context.globalState.get<unknown>(ownedEditorLabelPatternsKey);
    if (!Array.isArray(stored)) {
        return [];
    }
    return stored.filter((item): item is string => typeof item === "string");
}

/**
 * Sets the editor tab label for each open `.acp` file from the title in that file.
 * The label applies before the custom editor opens.
 */
export async function syncAcpUiBackgroundTabTitles(context: ExtensionContext): Promise<void> {
    const updates = new Map<string, string>();
    await Promise.all(
        openAcpTabUris().map(async (uri) => {
            const title = await readSessionTitleAtUri(uri);
            if (title === undefined) {
                return;
            }
            const template = customLabelTemplate(title);
            if (template === undefined) {
                return;
            }
            updates.set(uri.path, template);
        }),
    );

    const config = workspace.getConfiguration("workbench.editor.customLabels");
    const inspected = config.inspect<Record<string, string>>("patterns");
    const workspacePatterns = inspected?.workspaceValue;
    const hasWorkspace = (workspace.workspaceFolders?.length ?? 0) > 0;
    const target =
        workspacePatterns !== undefined && hasWorkspace
            ? ConfigurationTarget.Workspace
            : ConfigurationTarget.Global;
    const current =
        target === ConfigurationTarget.Workspace
            ? { ...inspected?.globalValue, ...workspacePatterns }
            : { ...inspected?.globalValue };
    const merged = mergeOwnedCustomLabelPatterns(current, ownedPatternsFromState(context), updates);
    if (!customLabelPatternsEqual(current, merged.patterns)) {
        await config.update("patterns", merged.patterns, target);
    }
    const previousOwned = ownedPatternsFromState(context);
    const ownedUnchanged =
        previousOwned.length === merged.owned.length &&
        previousOwned.every((pattern, index) => pattern === merged.owned[index]);
    if (!ownedUnchanged) {
        await context.globalState.update(ownedEditorLabelPatternsKey, merged.owned);
    }
}

let syncChain: Promise<void> = Promise.resolve();

function queueSync(context: ExtensionContext): void {
    syncChain = syncChain
        .catch(() => undefined)
        .then(() => syncAcpUiBackgroundTabTitles(context))
        .catch(() => undefined);
}

export function registerAcpUiBackgroundTabTitles(context: ExtensionContext): void {
    context.subscriptions.push(window.tabGroups.onDidChangeTabs(() => queueSync(context)));
    queueSync(context);
}
