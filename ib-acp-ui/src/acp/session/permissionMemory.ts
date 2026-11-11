import type * as acp from "@agentclientprotocol/sdk";

/** A remembered Allow always or Reject always choice for one tool kind. */
export type PermissionGrant = {
    scopeKey: string;
    decision: "allow" | "reject";
};

const allowKinds = ["allow_always", "allow_once"] as const;
const rejectKinds = ["reject_always", "reject_once"] as const;

/**
 * Scope for a remembered permission.
 * A tool kind covers later calls of that kind.
 * A request without a kind is scoped to its title.
 */
export function permissionScopeKey(toolCall: acp.ToolCallUpdate): string {
    const kind = toolCall.kind;
    if (typeof kind === "string" && kind.trim().length > 0) {
        return `kind:${kind.trim().toLowerCase()}`;
    }
    const title = typeof toolCall.title === "string" ? toolCall.title.trim() : "";
    if (title.length > 0) {
        return `title:${title}`;
    }
    return "kind:other";
}

/** Stores Allow always and Reject always. Allow once and Reject once stay one-shot. */
export function grantForSelectedOption(
    request: acp.RequestPermissionRequest,
    optionId: string,
): PermissionGrant | undefined {
    const option = request.options.find((entry) => entry.optionId === optionId);
    if (option === undefined) {
        return undefined;
    }
    const scopeKey = permissionScopeKey(request.toolCall);
    if (option.kind === "allow_always") {
        return { scopeKey, decision: "allow" };
    }
    if (option.kind === "reject_always") {
        return { scopeKey, decision: "reject" };
    }
    return undefined;
}

/**
 * Returns a permission response when this chat already remembered the tool kind.
 * Prefers the always option so the agent can record the choice too.
 */
export function stickyPermissionOutcome(
    grants: readonly PermissionGrant[],
    request: acp.RequestPermissionRequest,
): acp.RequestPermissionResponse | undefined {
    const scopeKey = permissionScopeKey(request.toolCall);
    const grant = grants.find((entry) => entry.scopeKey === scopeKey);
    if (grant === undefined) {
        return undefined;
    }
    const kinds = grant.decision === "allow" ? allowKinds : rejectKinds;
    for (const kind of kinds) {
        const option = request.options.find((entry) => entry.kind === kind);
        if (option !== undefined) {
            return { outcome: { outcome: "selected", optionId: option.optionId } };
        }
    }
    return undefined;
}

/**
 * Waiting requests that the new grant already answers.
 * The request the user just clicked is excluded.
 */
export function outcomesForMatchingGrants(
    grants: readonly PermissionGrant[],
    pending: ReadonlyMap<string, acp.RequestPermissionRequest>,
    exceptRequestId: string,
): Array<{ requestId: string; outcome: acp.RequestPermissionResponse }> {
    const matches: Array<{ requestId: string; outcome: acp.RequestPermissionResponse }> = [];
    for (const [requestId, request] of pending) {
        if (requestId === exceptRequestId) {
            continue;
        }
        const outcome = stickyPermissionOutcome(grants, request);
        if (outcome === undefined) {
            continue;
        }
        matches.push({ requestId, outcome });
    }
    return matches;
}

/** Replaces any earlier grant for the same scope. */
export function upsertPermissionGrant(
    grants: readonly PermissionGrant[],
    grant: PermissionGrant,
): PermissionGrant[] {
    return [...grants.filter((entry) => entry.scopeKey !== grant.scopeKey), grant];
}

/** Drops invalid rows from a session file. */
export function normalizePermissionGrants(value: unknown): PermissionGrant[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const grants: PermissionGrant[] = [];
    for (const row of value) {
        if (row === null || typeof row !== "object") {
            continue;
        }
        const record = row as Record<string, unknown>;
        if (typeof record.scopeKey !== "string" || record.scopeKey.length === 0) {
            continue;
        }
        if (record.decision !== "allow" && record.decision !== "reject") {
            continue;
        }
        const next = grants.filter((entry) => entry.scopeKey !== record.scopeKey);
        next.push({ scopeKey: record.scopeKey, decision: record.decision });
        grants.length = 0;
        grants.push(...next);
    }
    return grants;
}
