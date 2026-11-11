export type AcpUiTokenUsage = {
  /** Tokens currently in context, or the reported token count when the window size is unknown. */
  used: number;
  /** Context window size in tokens. Null when the agent did not report a window. */
  size: number | null;
};

function formatTokenCount(count: number): string {
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return String(count);
}

/** Formats context window usage like `13.3k/256.0k`. */
export function formatTokenUsage(usage: AcpUiTokenUsage): string {
  if (usage.size === null) {
    return formatTokenCount(usage.used);
  }
  return `${formatTokenCount(usage.used)}/${formatTokenCount(usage.size)}`;
}
