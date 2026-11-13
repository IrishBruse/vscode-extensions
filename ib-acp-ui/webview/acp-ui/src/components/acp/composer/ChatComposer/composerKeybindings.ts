export function shouldOpenNewChatOnCtrlT(args: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): boolean {
  return (
    args.key.toLowerCase() === "t" &&
    (args.ctrlKey || args.metaKey) &&
    !args.altKey &&
    !args.shiftKey
  );
}

export function shouldCycleSessionModeOnShiftTab(args: {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): boolean {
  return args.key === "Tab" && args.shiftKey && !args.ctrlKey && !args.metaKey && !args.altKey;
}

export function canCancelTurn(input: {
  promptInFlight: boolean;
  thoughtRunning: boolean;
  commandRunning: boolean;
}): boolean {
  return input.promptInFlight || input.thoughtRunning || input.commandRunning;
}

export function shouldCancelRunOnCtrlC(args: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  hasSelection: boolean;
  promptInFlight: boolean;
  thoughtRunning?: boolean;
  commandRunning?: boolean;
}): boolean {
  return (
    args.key.toLowerCase() === "c" &&
    args.ctrlKey &&
    !args.metaKey &&
    !args.altKey &&
    !args.shiftKey &&
    !args.hasSelection &&
    canCancelTurn({
      promptInFlight: args.promptInFlight,
      thoughtRunning: args.thoughtRunning === true,
      commandRunning: args.commandRunning === true,
    })
  );
}
