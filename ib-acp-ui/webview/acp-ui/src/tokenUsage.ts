export type AcpUiTokenUsage = {
  /** Tokens currently in context; null until the agent reports a count. */
  used: number | null;
  /** Context window size in tokens. Null when the window is unknown. */
  size: number | null;
};

function formatTokenCount(count: number): string {
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return String(count);
}

/** Formats context window usage like `13.3k/256.0k`, or `—/200.0k` when only the window is known. */
export function formatTokenUsage(usage: AcpUiTokenUsage): string {
  const usedLabel =
    usage.used === null ? "\u2014" : formatTokenCount(usage.used);
  if (usage.size === null) {
    return usage.used === null ? "\u2014" : usedLabel;
  }
  return `${usedLabel}/${formatTokenCount(usage.size)}`;
}
