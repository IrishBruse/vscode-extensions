import type * as acp from "@agentclientprotocol/sdk";
import {
  createToolCallKindTracking,
  extensionMessagesForPermissionRequest,
  sessionUpdateToWebviewMessages,
} from "../../../../../src/acp/mapping/sessionUpdateMapping";
import { parseReadmeSessionSeedFromJson } from "../../../../../src/acp/session/readmeSessionSeed";
import type { ExtensionToWebviewMessage } from "../../../../../src/protocol/extensionHostMessages";
import {
  chatReducer,
  createChatStateFromInit,
  type ChatState,
  type ExtensionMessageAfterInit,
  type InitPayload,
} from "../../chatReducer";

type FixtureLine = {
  method?: string;
  params?: {
    update?: acp.SessionUpdate;
  };
  result?: {
    stopReason?: string;
  };
};

function isAfterInit(message: ExtensionToWebviewMessage): message is ExtensionMessageAfterInit {
  return message.type !== "init";
}

/**
 * Replays a playground chat fixture into the same chat state the demo host built.
 */
export function chatFromFixture(
  ndjson: string,
  seedText?: string,
): { init: InitPayload; state: ChatState } {
  const seed =
    seedText !== undefined && seedText.length > 0
      ? parseReadmeSessionSeedFromJson(seedText)
      : { modelSelection: null, configOptions: null };
  const init: InitPayload = {
    type: "init",
    sessionId: "storybook",
    title: "ACP UI",
    workspaceLabel: "~/vscode-extensions",
    acpAgentName: "Cursor",
    providers: ["Cursor"],
    lockSessionAgent: true,
    ...(seed.configOptions !== null ? { sessionConfigOptionsSeed: seed.configOptions } : {}),
    ...(seed.modelSelection !== null ? { sessionModels: seed.modelSelection } : {}),
  };
  let state = createChatStateFromInit(init);
  const tracking = createToolCallKindTracking();
  let stopReason = "end_turn";
  const lines = ndjson.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() ?? "";
    if (trimmed.length === 0) {
      continue;
    }
    const msg = JSON.parse(trimmed) as FixtureLine;
    if (msg.method === "session/update" && msg.params?.update !== undefined) {
      for (const message of sessionUpdateToWebviewMessages(msg.params.update, tracking)) {
        if (isAfterInit(message)) {
          state = chatReducer(state, message);
        }
      }
      continue;
    }
    if (msg.method === "session/request_permission" && msg.params !== undefined) {
      for (const message of extensionMessagesForPermissionRequest(
        `perm-${index}`,
        msg.params as acp.RequestPermissionRequest,
      )) {
        if (isAfterInit(message)) {
          state = chatReducer(state, message);
        }
      }
      continue;
    }
    if (msg.method === undefined && typeof msg.result?.stopReason === "string") {
      stopReason = msg.result.stopReason;
    }
  }
  if (ndjson.trim().length > 0) {
    state = chatReducer(state, { type: "turnComplete", stopReason });
  }
  return { init, state };
}
