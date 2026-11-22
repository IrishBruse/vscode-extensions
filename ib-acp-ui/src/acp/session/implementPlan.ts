/** Plan the user accepted from `cursor/create_plan`. */
export type AcceptedPlan = {
    name?: string;
    plan: string;
};

const agentModeValues = ["agent", "code", "default"] as const;

/** Session mode value that can edit and run tools. */
export function agentModeConfigValue(optionValues: readonly string[]): string {
    for (const preferred of agentModeValues) {
        if (optionValues.includes(preferred)) {
            return preferred;
        }
    }
    return "agent";
}

/**
 * Follow-up prompt after the user accepts a plan.
 * The plan text is included because the next turn only receives this message.
 */
export function implementPlanPrompt(plan: AcceptedPlan): string {
    const heading = plan.plan.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const title = plan.name?.trim() || heading || "Plan";
    return [
        title,
        "",
        "Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.",
        "",
        "To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.",
        "",
        plan.plan.trim(),
    ].join("\n");
}
