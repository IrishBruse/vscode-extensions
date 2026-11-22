import { describe, expect, it } from "vite-plus/test";
import { agentModeConfigValue, implementPlanPrompt } from "./implementPlan";

describe("agentModeConfigValue", () => {
    it("picks agent when the session advertises it", () => {
        expect(agentModeConfigValue(["plan", "agent", "ask"])).toBe("agent");
    });

    it("falls back to agent when the mode list is empty", () => {
        expect(agentModeConfigValue([])).toBe("agent");
    });
});

describe("implementPlanPrompt", () => {
    it("asks the agent to implement the accepted plan", () => {
        const prompt = implementPlanPrompt({
            name: "Fix the path",
            plan: "# Fix the path\n\nUpdate the launcher.",
        });
        expect(prompt.startsWith("Fix the path\n")).toBe(true);
        expect(prompt).toContain("Implement the plan as specified");
        expect(prompt).toContain("Update the launcher.");
    });
});
