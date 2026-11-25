import { workspace } from "vscode";

const settingKey = "ib-acp-ui.autoApproveWebFetchAndSearch";

/** True when web fetch and web search permissions are approved without a dialog. */
export function readAutoApproveWebFetchAndSearch(): boolean {
    return workspace.getConfiguration().get<boolean>(settingKey, false) === true;
}

export { settingKey as autoApproveWebFetchAndSearchSettingKey };
