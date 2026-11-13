import type { AcpUiPromptImage } from "../../../../../../../src/protocol/extensionHostMessages";

export type FollowUpMode = "queue" | "steer";

export type QueuedFollowUp = {
  id: number;
  body: string;
  images: AcpUiPromptImage[];
  mode: FollowUpMode;
};

export type FollowUpEnterAction = "send-now" | "ignore" | "enqueue" | "steer" | "interrupt";

/**
 * Enter while the agent is idle sends now.
 * Enter during a turn appends the draft to the queue.
 * Enter with an empty composer marks the next queued message as steering.
 * The Enter after that interrupts the current turn and sends that message.
 * Messages behind it stay in the queue.
 */
export function resolveFollowUpEnter(input: {
  promptInFlight: boolean;
  hasContent: boolean;
  queuedMode: FollowUpMode | null;
}): FollowUpEnterAction {
  if (!input.promptInFlight) {
    if (input.queuedMode !== null && input.hasContent) {
      return "enqueue";
    }
    return input.hasContent ? "send-now" : "ignore";
  }
  if (input.hasContent) {
    return "enqueue";
  }
  if (input.queuedMode === "queue") {
    return "steer";
  }
  if (input.queuedMode === "steer") {
    return "interrupt";
  }
  return "ignore";
}

const runningToolStatuses = new Set(["pending", "in_progress"]);

export function hasRunningTool(statuses: readonly string[]): boolean {
  return statuses.some((status) => runningToolStatuses.has(status));
}

/**
 * Steering waits out a tool that is already running, then stops the rest of the turn.
 * A turn with no running tool is left alone until it finishes.
 */
export function steerShouldStopAfterTool(input: {
  sawRunningTool: boolean;
  toolRunning: boolean;
  promptInFlight: boolean;
}): boolean {
  return input.promptInFlight && input.sawRunningTool && !input.toolRunning;
}
