import { describe, expect, it } from "vite-plus/test";
import { virtualTraceWindow } from "./virtualTraceWindow";

const heightAt = (): number => 100;

describe("virtualTraceWindow", () => {
  it("returns an empty window for no rows", () => {
    expect(
      virtualTraceWindow({ count: 0, heightAt, scrollTop: 0, viewportHeight: 200 }),
    ).toEqual({ start: 0, end: 0, paddingTop: 0, paddingBottom: 0 });
  });

  it("keeps the rows that cover the viewport plus overscan", () => {
    const window = virtualTraceWindow({
      count: 50,
      heightAt,
      scrollTop: 2000,
      viewportHeight: 400,
      overscanPx: 200,
    });

    expect(window.start).toBe(18);
    expect(window.end).toBe(26);
    expect(window.paddingTop).toBe(1800);
    expect(window.paddingBottom).toBe(2400);
  });

  it("includes the last row when the viewport is at the bottom", () => {
    const window = virtualTraceWindow({
      count: 50,
      heightAt,
      scrollTop: 4600,
      viewportHeight: 400,
      overscanPx: 200,
    });

    expect(window.end).toBe(50);
    expect(window.paddingBottom).toBe(0);
    expect(window.start).toBe(44);
  });
});
