# Storybook

## User facing

This surface is for extension developers, not end users.

Run `npm run storybook` to open the chat UI in a browser without installing the VS Code extension.
Storybook serves the component catalog on port 6006.

The sidebar has three groups.
**ACP** holds the chat controls, grouped into trace, tools, composer, dialogs, and session.
**VS Code** holds workbench-style controls.
**Scenarios** replays the fixture chats and model-picker seeds that used to live in the playground.

## Implementation

### Stories

Component stories live next to each component under `webview/acp-ui/src/components/`.
Scenario stories import the NDJSON fixtures in `fixtures/chats/` and the composer seeds in `fixtures/`.
[chatFromFixture](../../../webview/acp-ui/src/components/scenarios/replayFixture.ts) feeds those lines through [sessionUpdateToWebviewMessages](../../../src/acp/mapping/sessionUpdateMapping.ts) and [chatReducer](../../../webview/acp-ui/src/chatReducer.ts).

### Theme

[resolvePlaygroundThemeCssVariables](../../../src/platform/node/resolvePlaygroundThemeCssVariables.ts) reads VS Code user settings for workbench colors.
The Storybook server exposes that payload at `/api/playground-theme`.
[applyPlaygroundVsCodeTheme](../../../webview/acp-ui/src/storybook/applyVsCodeTheme.ts) writes the variables onto the preview document.

### Screenshots

`npm run screenshots` builds fixtures and captures README images from the scenario stories.
