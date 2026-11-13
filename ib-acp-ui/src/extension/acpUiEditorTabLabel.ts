/** VS Code drops a custom label template that has no letter or digit. */
const customLabelTemplateHasToken = /[a-zA-Z0-9]/;

/**
 * Turns a chat title into a custom editor label template.
 * A `${` sequence is broken so VS Code does not treat it as a path token.
 */
export function customLabelTemplate(title: string): string | undefined {
    const trimmed = title.trim();
    if (!customLabelTemplateHasToken.test(trimmed)) {
        return undefined;
    }
    return trimmed.replaceAll("${", "$\u200b{");
}

/**
 * Keeps user label patterns and replaces only the patterns this extension owns.
 */
export function mergeOwnedCustomLabelPatterns(
    current: Readonly<Record<string, string>>,
    ownedPatterns: readonly string[],
    updates: ReadonlyMap<string, string>,
): { patterns: Record<string, string>; owned: string[] } {
    const owned = new Set(ownedPatterns);
    const patterns: Record<string, string> = {};
    for (const [key, value] of Object.entries(current)) {
        if (owned.has(key)) {
            continue;
        }
        patterns[key] = value;
    }
    const nextOwned: string[] = [];
    for (const [key, value] of updates) {
        if (!owned.has(key) && key in current) {
            continue;
        }
        patterns[key] = value;
        nextOwned.push(key);
    }
    return { patterns, owned: nextOwned };
}

export function customLabelPatternsEqual(
    left: Readonly<Record<string, string>>,
    right: Readonly<Record<string, string>>,
): boolean {
    const leftKeys = Object.keys(left);
    if (leftKeys.length !== Object.keys(right).length) {
        return false;
    }
    return leftKeys.every((key) => left[key] === right[key]);
}
