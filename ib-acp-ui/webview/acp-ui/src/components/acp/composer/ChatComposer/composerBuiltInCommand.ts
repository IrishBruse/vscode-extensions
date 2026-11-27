export type BuiltInSlashCommand = "clear" | "new" | "show-thinking" | "rename";

/** Built-in composer command after trimming, so a suggestion's trailing space still matches. */
export function builtInSlashCommand(body: string): BuiltInSlashCommand | undefined {
  const command = body.trim().toLowerCase();
  if (command === "/clear") {
    return "clear";
  }
  if (command === "/new") {
    return "new";
  }
  if (command === "/show-thinking") {
    return "show-thinking";
  }
  if (command.startsWith("/rename")) {
    return "rename";
  }
  return undefined;
}
