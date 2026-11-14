import type { SubagentWorkState, ToolCallStatus } from "../../../../../../../src/protocol/extensionHostMessages";

/** Status text for an ACP child session. */
export function subagentStatusLabel(
  state: SubagentWorkState | null,
  stopReason: string | null,
): string {
  if (state === "running") {
    return "Running";
  }
  if (state === "requires_action") {
    return "Needs action";
  }
  if (state === "idle" && stopReason === "error") {
    return "Failed";
  }
  if (state === "idle" && stopReason === "cancelled") {
    return "Cancelled";
  }
  if (state === "idle") {
    return "Idle";
  }
  return "Unknown";
}

/** Status text for a Cursor task card. */
export function taskStatusLabel(status: ToolCallStatus, stopReason?: string): string {
  if (stopReason === "unknown") {
    return "Unknown";
  }
  if (stopReason === "requires_action") {
    return "Needs action";
  }
  if (status === "pending" || status === "in_progress") {
    return "Running";
  }
  if (stopReason === "cancelled") {
    return "Cancelled";
  }
  if (status === "failed" || stopReason === "error") {
    return "Failed";
  }
  return "Done";
}
