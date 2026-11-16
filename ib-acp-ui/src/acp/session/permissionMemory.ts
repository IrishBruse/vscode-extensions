import type * as acp from "@agentclientprotocol/sdk";

/** A remembered Allow always or Reject always choice for one tool kind. */
export type PermissionGrant = {
    scopeKey: string;
    decision: "allow" | "reject";
};

const allowKinds = ["allow_always", "allow_once"] as const;
const rejectKinds = ["reject_always", "reject_once"] as const;

type StickyPermissionKind = (typeof allowKinds)[number] | (typeof rejectKinds)[number];

/** Resolves the effective tool kind for permission memory. */
export function resolveToolCallKind(
    toolCall: acp.ToolCallUpdate,
    trackedKind?: string,
): string | undefined {
    if (typeof toolCall.kind === "string" && toolCall.kind.trim().length > 0) {
        return toolCall.kind.trim().toLowerCase();
    }
    if (typeof trackedKind === "string" && trackedKind.trim().length > 0) {
        return trackedKind.trim().toLowerCase();
    }
    const name = typeof toolCall.name === "string" ? toolCall.name.trim().toLowerCase() : "";
    if (name.length > 0) {
        return name;
    }
    const title = typeof toolCall.title === "string" ? toolCall.title.trim() : "";
    if (/^delete\b/i.test(title)) {
        return "delete";
    }
    if (/^write file\b/i.test(title) || /^edit\b/i.test(title)) {
        return "edit";
    }
    if (/^run\b/i.test(title) || /^execute\b/i.test(title)) {
        return "execute";
    }
    return undefined;
}

/**
 * Scope for a remembered permission.
 * A tool kind covers later calls of that kind.
 */
export function permissionScopeKey(toolCall: acp.ToolCallUpdate, trackedKind?: string): string {
    const kind = resolveToolCallKind(toolCall, trackedKind);
    if (kind !== undefined) {
        return `kind:${kind}`;
    }
    const title = typeof toolCall.title === "string" ? toolCall.title.trim() : "";
    if (title.length > 0) {
        return `title:${title}`;
    }
    return "kind:other";
}

/**
 * Fills a missing `toolCall.kind` from the live trace or the title before scoping a grant.
 */
export function enrichPermissionRequest(
    request: acp.RequestPermissionRequest,
    trackedKind?: string,
): acp.RequestPermissionRequest {
    const resolvedKind = resolveToolCallKind(request.toolCall, trackedKind);
    if (resolvedKind === undefined) {
        return request;
    }
    if (typeof request.toolCall.kind === "string" && request.toolCall.kind.trim().length > 0) {
        return request;
    }
    return {
        ...request,
        toolCall: { ...request.toolCall, kind: resolvedKind as acp.ToolKind },
    };
}

function permissionOptionMemoryKind(
    option: acp.PermissionOption,
): "allow_always" | "reject_always" | undefined {
    if (option.kind === "allow_always" || option.kind === "reject_always") {
        return option.kind;
    }
    const id = option.optionId.trim().toLowerCase();
    const name = option.name.trim().toLowerCase();
    if ((id.includes("allow") && id.includes("always")) || name === "allow always") {
        return "allow_always";
    }
    if ((id.includes("reject") && id.includes("always")) || name === "reject always") {
        return "reject_always";
    }
    return undefined;
}

function findPermissionOption(
    options: readonly acp.PermissionOption[],
    memoryKind: StickyPermissionKind,
): acp.PermissionOption | undefined {
    const byKind = options.find((entry) => entry.kind === memoryKind);
    if (byKind !== undefined) {
        return byKind;
    }
    if (memoryKind === "allow_always" || memoryKind === "reject_always") {
        return options.find((entry) => permissionOptionMemoryKind(entry) === memoryKind);
    }
    return undefined;
}

/** Stores Allow always and Reject always. Allow once and Reject once stay one-shot. */
export function grantForSelectedOption(
    request: acp.RequestPermissionRequest,
    optionId: string,
    trackedKind?: string,
): PermissionGrant | undefined {
    const enriched = enrichPermissionRequest(request, trackedKind);
    const option = enriched.options.find((entry) => entry.optionId === optionId);
    if (option === undefined) {
        return undefined;
    }
    const scopeKey = permissionScopeKey(enriched.toolCall, trackedKind);
    const memoryKind = permissionOptionMemoryKind(option);
    if (memoryKind === "allow_always") {
        return { scopeKey, decision: "allow" };
    }
    if (memoryKind === "reject_always") {
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
    trackedKind?: string,
): acp.RequestPermissionResponse | undefined {
    const enriched = enrichPermissionRequest(request, trackedKind);
    const scopeKey = permissionScopeKey(enriched.toolCall, trackedKind);
    const grant = grants.find((entry) => entry.scopeKey === scopeKey);
    if (grant === undefined) {
        return undefined;
    }
    const kinds = grant.decision === "allow" ? allowKinds : rejectKinds;
    for (const kind of kinds) {
        const option = findPermissionOption(enriched.options, kind);
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
    kindForRequest?: (request: acp.RequestPermissionRequest) => string | undefined,
): Array<{ requestId: string; outcome: acp.RequestPermissionResponse }> {
    const matches: Array<{ requestId: string; outcome: acp.RequestPermissionResponse }> = [];
    for (const [requestId, request] of pending) {
        if (requestId === exceptRequestId) {
            continue;
        }
        const trackedKind = kindForRequest?.(request);
        const outcome = stickyPermissionOutcome(grants, request, trackedKind);
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
