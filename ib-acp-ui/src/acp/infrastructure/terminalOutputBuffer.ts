/** Default cap when the agent omits `outputByteLimit` on `terminal/create`. */
export const defaultTerminalOutputByteLimit = 1_048_576;

/**
 * Keeps a UTF-8 string within `maxBytes` by dropping the oldest content at a code-unit boundary.
 */
export function truncateTerminalOutput(
    output: string,
    maxBytes: number,
): { output: string; truncated: boolean } {
    if (Buffer.byteLength(output, "utf8") <= maxBytes) {
        return { output, truncated: false };
    }
    let low = 0;
    let high = output.length;
    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const suffix = output.slice(mid);
        if (Buffer.byteLength(suffix, "utf8") <= maxBytes) {
            high = mid;
        } else {
            low = mid + 1;
        }
    }
    let start = low;
    if (start > 0 && start < output.length) {
        const code = output.charCodeAt(start);
        if (code >= 0xdc00 && code <= 0xdfff) {
            start += 1;
        }
    }
    return { output: output.slice(start), truncated: true };
}
