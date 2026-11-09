import { describe, expect, it } from "vite-plus/test";
import {
  previousThoughtIndexToCollapse,
  rectIntersectsScrollport,
} from "./thoughtCollapse";

describe("previousThoughtIndexToCollapse", () => {
  it("collapses the previous thought when a new one appears while following the bottom", () => {
    expect(
      previousThoughtIndexToCollapse({
        previousThoughtIndexes: [1],
        nextThoughtIndexes: [1, 4],
        followBottom: true,
        previousThoughtInView: true,
      }),
    ).toBe(1);
  });

  it("keeps the previous thought open when the view is scrolled up onto it", () => {
    expect(
      previousThoughtIndexToCollapse({
        previousThoughtIndexes: [1],
        nextThoughtIndexes: [1, 4],
        followBottom: false,
        previousThoughtInView: true,
      }),
    ).toBeUndefined();
  });

  it("collapses the previous thought when the view is scrolled up but that block is off screen", () => {
    expect(
      previousThoughtIndexToCollapse({
        previousThoughtIndexes: [1, 3],
        nextThoughtIndexes: [1, 3, 6],
        followBottom: false,
        previousThoughtInView: false,
      }),
    ).toBe(3);
  });

  it("does not collapse while the same thought is still streaming", () => {
    expect(
      previousThoughtIndexToCollapse({
        previousThoughtIndexes: [1, 3],
        nextThoughtIndexes: [1, 3],
        followBottom: true,
        previousThoughtInView: false,
      }),
    ).toBeUndefined();
  });

  it("does not collapse the first thought", () => {
    expect(
      previousThoughtIndexToCollapse({
        previousThoughtIndexes: [],
        nextThoughtIndexes: [2],
        followBottom: true,
        previousThoughtInView: false,
      }),
    ).toBeUndefined();
  });
});

describe("rectIntersectsScrollport", () => {
  it("is true when the row crosses the scrollport", () => {
    expect(
      rectIntersectsScrollport({ top: 80, bottom: 140 }, { top: 100, bottom: 400 }),
    ).toBe(true);
  });

  it("is false when the row is fully above or below the scrollport", () => {
    expect(
      rectIntersectsScrollport({ top: 0, bottom: 40 }, { top: 100, bottom: 400 }),
    ).toBe(false);
    expect(
      rectIntersectsScrollport({ top: 420, bottom: 500 }, { top: 100, bottom: 400 }),
    ).toBe(false);
  });
});
