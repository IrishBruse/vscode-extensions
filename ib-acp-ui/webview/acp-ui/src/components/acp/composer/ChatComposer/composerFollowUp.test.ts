import { describe, expect, it } from "vite-plus/test";
import {
  followUpAccessibilityLabel,
  followUpBodyText,
  hasRunningTool,
  resolveFollowUpEnter,
  steerShouldStopAfterTool,
} from "./composerFollowUp";

const sampleImage = { mimeType: "image/png", data: "QUJD" };

describe("followUpAccessibilityLabel", () => {
  it("includes image count in the tooltip when text and images are queued", () => {
    expect(
      followUpAccessibilityLabel({
        id: 1,
        body: "Look at this",
        images: [sampleImage],
        mode: "queue",
      }),
    ).toBe("Look at this (1 image)");
  });

  it("labels image-only queue items", () => {
    expect(
      followUpAccessibilityLabel({
        id: 1,
        body: "",
        images: [sampleImage, sampleImage],
        mode: "queue",
      }),
    ).toBe("2 images");
  });
});

describe("followUpBodyText", () => {
  it("normalizes whitespace for the visible row text", () => {
    expect(
      followUpBodyText({
        id: 1,
        body: "  line one\nline two ",
        images: [],
        mode: "queue",
      }),
    ).toBe("line one line two");
  });
});

describe("resolveFollowUpEnter", () => {
  it("sends immediately when the agent is idle", () => {
    expect(
      resolveFollowUpEnter({
        promptInFlight: false,
        hasContent: true,
        queuedMode: null,
      }),
    ).toBe("send-now");
  });

  it("queues the first enter while the agent is running", () => {
    expect(
      resolveFollowUpEnter({
        promptInFlight: true,
        hasContent: true,
        queuedMode: null,
      }),
    ).toBe("enqueue");
  });

  it("appends another draft behind the queued message", () => {
    expect(
      resolveFollowUpEnter({
        promptInFlight: true,
        hasContent: true,
        queuedMode: "queue",
      }),
    ).toBe("enqueue");
    expect(
      resolveFollowUpEnter({
        promptInFlight: true,
        hasContent: true,
        queuedMode: "steer",
      }),
    ).toBe("enqueue");
  });

  it("marks the queued message as steering on the next enter", () => {
    expect(
      resolveFollowUpEnter({
        promptInFlight: true,
        hasContent: false,
        queuedMode: "queue",
      }),
    ).toBe("steer");
  });

  it("interrupts the current turn on the enter after steering", () => {
    expect(
      resolveFollowUpEnter({
        promptInFlight: true,
        hasContent: false,
        queuedMode: "steer",
      }),
    ).toBe("interrupt");
  });
});

describe("steerShouldStopAfterTool", () => {
  it("waits while a tool is still running", () => {
    expect(hasRunningTool(["in_progress"])).toBe(true);
    expect(
      steerShouldStopAfterTool({
        sawRunningTool: true,
        toolRunning: true,
        promptInFlight: true,
      }),
    ).toBe(false);
  });

  it("stops the turn after the running tool finishes", () => {
    expect(
      steerShouldStopAfterTool({
        sawRunningTool: true,
        toolRunning: false,
        promptInFlight: true,
      }),
    ).toBe(true);
  });

  it("does not cancel a turn that has no running tool", () => {
    expect(
      steerShouldStopAfterTool({
        sawRunningTool: false,
        toolRunning: false,
        promptInFlight: true,
      }),
    ).toBe(false);
  });
});
