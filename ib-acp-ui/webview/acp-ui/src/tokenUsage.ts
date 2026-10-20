export type AcpUiTokenUsage = {
  used: number;
  size: number;
};

function formatTokenCount(count: number): string {
  if (count >= 1_000) {
    const thousands = count / 1_000;
    const rounded = thousands >= 100 ? Math.round(thousands) : Math.round(thousands * 10) / 10;
    return `${rounded}k`;
  }
  return String(count);
}

/**
 * Formats context window usage like `12.3k/200k (6%)`.
 */
export function formatTokenUsage(usage: AcpUiTokenUsage): string {
  const percent = usage.size > 0 ? Math.round((usage.used / usage.size) * 100) : 0;
  return `${formatTokenCount(usage.used)}/${formatTokenCount(usage.size)} (${percent}%)`;
}
