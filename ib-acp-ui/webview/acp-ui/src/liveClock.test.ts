import { describe, expect, it } from "vite-plus/test";
import { publishHostClock, subscribeLiveClock } from "./liveClock";

describe("publishHostClock", () => {
  it("sends the host time to a live timer", () => {
    const samples: number[] = [];
    const stop = subscribeLiveClock((nowMs) => {
      samples.push(nowMs);
    });
    publishHostClock(1_700_000_000_100);
    stop();
    expect(samples.at(-1)).toBe(1_700_000_000_100);
  });
});
