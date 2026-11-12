/**
 * Tick for clocks that show one decimal place, for example `1.2s`.
 * A webview `setInterval` is often limited to one second, so the extension host sends this tick.
 */
export const liveClockIntervalMs = 100;
