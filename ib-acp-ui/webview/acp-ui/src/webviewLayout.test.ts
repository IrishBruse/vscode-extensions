import { describe, expect, it } from "vite-plus/test";
import { webviewLayoutIsMeasurable, webviewWidthIsMeasurable } from "./webviewLayout";

describe("webviewLayoutIsMeasurable", () => {
  it("accepts a visible webview with size", () => {
    expect(
      webviewLayoutIsMeasurable({
        visibilityState: "visible",
        clientWidth: 900,
        clientHeight: 600,
      }),
    ).toBe(true);
  });

  it("rejects a hidden or collapsed webview", () => {
    expect(
      webviewLayoutIsMeasurable({
        visibilityState: "hidden",
        clientWidth: 900,
        clientHeight: 600,
      }),
    ).toBe(false);
    expect(
      webviewLayoutIsMeasurable({
        visibilityState: "visible",
        clientWidth: 0,
        clientHeight: 0,
      }),
    ).toBe(false);
  });
});

describe("webviewWidthIsMeasurable", () => {
  it("rejects a zero-width webview", () => {
    expect(
      webviewWidthIsMeasurable({
        visibilityState: "visible",
        clientWidth: 0,
      }),
    ).toBe(false);
  });
});
