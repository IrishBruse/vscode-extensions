import { describe, expect, it } from "vite-plus/test";
import { formatRelativeTime } from "./relativeTime";

const now = Date.UTC(2026, 0, 10, 12, 0, 0);

describe("formatRelativeTime", () => {
  it("returns just now under a minute", () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe("just now");
  });

  it("formats minutes and hours", () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toMatch(/5 minutes ago|in 5 minutes/);
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toMatch(/3 hours ago|in 3 hours/);
  });

  it("formats days then falls back to a date", () => {
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toMatch(/2 days ago|in 2 days/);
    expect(formatRelativeTime(now - 30 * 86_400_000, now)).not.toMatch(/ago/);
  });
});
