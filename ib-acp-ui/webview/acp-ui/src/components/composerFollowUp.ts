export type FollowUpMode = "queue" | "steer";

export type FollowUpEnterAction = "send-now" | "ignore" | "enqueue" | "steer" | "interrupt";

/**
 * Enter while the agent is idle sends now.
 * The first Enter during a turn queues the draft for the end of that turn.
 * The next Enter marks that message as steering.
 * The Enter after that interrupts the current turn.
 * A new draft replaces the queued message and starts again at queue.
 */
export function resolveFollowUpEnter(input: {
  promptInFlight: boolean;
  hasContent: boolean;
  queuedMode: FollowUpMode | null;
}): FollowUpEnterAction {
  if (!input.promptInFlight) {
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
