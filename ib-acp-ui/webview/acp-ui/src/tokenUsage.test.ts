import { describe, expect, it } from "vite-plus/test";
import { formatTokenUsage } from "./tokenUsage";

describe("formatTokenUsage", () => {
  it("formats thousands with one decimal and a whole percent", () => {
    expect(formatTokenUsage({ used: 12345, size: 200000 })).toBe("12.3k/200k (6%)");
  });

  it("drops the decimal for hundreds of thousands", () => {
    expect(formatTokenUsage({ used: 150000, size: 300000 })).toBe("150k/300k (50%)");
  });

  it("keeps exact thousands without a decimal", () => {
    expect(formatTokenUsage({ used: 12000, size: 200000 })).toBe("12k/200k (6%)");
  });

  it("prints small counts without a suffix", () => {
    expect(formatTokenUsage({ used: 500, size: 1000 })).toBe("500/1k (50%)");
  });

  it("reports zero percent when the size is unknown", () => {
    expect(formatTokenUsage({ used: 500, size: 0 })).toBe("500/0 (0%)");
  });
});
