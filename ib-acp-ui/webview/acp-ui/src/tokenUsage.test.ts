import { describe, expect, it } from "vite-plus/test";
import { formatTokenUsage } from "./tokenUsage";

describe("formatTokenUsage", () => {
  it("formats both sides with one decimal", () => {
    expect(formatTokenUsage({ used: 13300, size: 256000 })).toBe("13.3k/256.0k");
  });

  it("keeps one decimal on an exact thousand", () => {
    expect(formatTokenUsage({ used: 12000, size: 200000 })).toBe("12.0k/200.0k");
  });

  it("prints small counts without a suffix", () => {
    expect(formatTokenUsage({ used: 500, size: 1000 })).toBe("500/1.0k");
  });

  it("prints a zero window size as zero", () => {
    expect(formatTokenUsage({ used: 500, size: 0 })).toBe("500/0");
  });

  it("shows only the token count when the window size is missing", () => {
    expect(formatTokenUsage({ used: 12345, size: null })).toBe("12.3k");
  });
});
