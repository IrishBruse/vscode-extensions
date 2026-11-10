import { describe, expect, it } from "vite-plus/test";
import {
    agentTabGeneratingFrames,
    agentTabIndicatorForTurn,
    agentTabTitleFrameMs,
    formatAgentTabTitle,
} from "./agentTabTitle";

describe("agent tab title", () => {
    it("uses the Cursor agent monochrome generating frames", () => {
        expect(agentTabGeneratingFrames).toEqual(["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"]);
        expect(agentTabTitleFrameMs).toBe(200);
        expect(formatAgentTabTitle("Fix login", "generating", 0)).toBe("Fix login ⠋");
        expect(formatAgentTabTitle("Fix login", "generating", 1)).toBe("Fix login ⠙");
        expect(formatAgentTabTitle("Fix login", "generating", 8)).toBe("Fix login ⠋");
    });

    it("uses the other monochrome marks and restores the name when idle", () => {
        expect(formatAgentTabTitle("Fix login", "shell-running", 0)).toBe("Fix login ❯");
        expect(formatAgentTabTitle("Fix login", "reviewing", 0)).toBe("Fix login ✎");
        expect(formatAgentTabTitle("Fix login", "planning", 0)).toBe("Fix login ◇");
        expect(formatAgentTabTitle("Fix login", "waiting-for-user", 0)).toBe("Fix login ?");
        expect(formatAgentTabTitle("Fix login", "waiting-for-confirmation", 0)).toBe("Fix login !");
        expect(formatAgentTabTitle("Fix login", "queued", 0)).toBe("Fix login ≡");
        expect(formatAgentTabTitle("Fix login", null, 0)).toBe("Fix login");
    });

    it("maps a turn to the same marks as the Cursor agent title", () => {
        expect(
            agentTabIndicatorForTurn({
                promptInFlight: true,
                waitingForUser: false,
                waitingForConfirmation: false,
            }),
        ).toBe("generating");
        expect(
            agentTabIndicatorForTurn({
                promptInFlight: true,
                waitingForUser: false,
                waitingForConfirmation: false,
                waitingForPlan: true,
            }),
        ).toBe("planning");
        expect(
            agentTabIndicatorForTurn({
                promptInFlight: true,
                waitingForUser: true,
                waitingForConfirmation: false,
            }),
        ).toBe("waiting-for-user");
        expect(
            agentTabIndicatorForTurn({
                promptInFlight: false,
                waitingForUser: false,
                waitingForConfirmation: true,
            }),
        ).toBe("waiting-for-confirmation");
        expect(
            agentTabIndicatorForTurn({
                promptInFlight: false,
                waitingForUser: false,
                waitingForConfirmation: false,
            }),
        ).toBeNull();
    });
});
