import type * as acp from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vite-plus/test";
import {
    type PermissionGrant,
    grantForSelectedOption,
    outcomesForMatchingGrants,
    stickyPermissionOutcome,
} from "./permissionMemory";

const allowOptions: acp.PermissionOption[] = [
    { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
    { optionId: "allow-always", name: "Allow always", kind: "allow_always" },
    { optionId: "reject-once", name: "Reject", kind: "reject_once" },
];

function permissionRequest(
    kind: acp.ToolKind,
    title: string,
    options: acp.PermissionOption[] = allowOptions,
): acp.RequestPermissionRequest {
    return {
        sessionId: "sess-1",
        toolCall: { toolCallId: "call-1", kind, title, status: "pending" },
        options,
    };
}

describe("sticky permission", () => {
    it("approves a later request of the same tool kind after Allow always", () => {
        const first = permissionRequest("execute", "`git status`");
        const grant = grantForSelectedOption(first, "allow-always");
        expect(grant).toEqual({ scopeKey: "kind:execute", decision: "allow" });
        const grants: PermissionGrant[] = grant === undefined ? [] : [grant];
        const second = permissionRequest("execute", "`npm test`");
        expect(stickyPermissionOutcome(grants, second)).toEqual({
            outcome: { outcome: "selected", optionId: "allow-always" },
        });
    });

    it("asks again after Allow once", () => {
        const first = permissionRequest("execute", "`git status`");
        expect(grantForSelectedOption(first, "allow-once")).toBeUndefined();
    });

    it("answers other waiting requests of that tool kind", () => {
        const grants: PermissionGrant[] = [{ scopeKey: "kind:edit", decision: "allow" }];
        const pending = new Map<string, acp.RequestPermissionRequest>([
            ["perm-10", permissionRequest("edit", "Delete `left.png`")],
            ["perm-11", permissionRequest("edit", "Delete `right.png`")],
            ["perm-13", permissionRequest("edit", "Delete `lower.png`")],
            ["perm-14", permissionRequest("execute", "`rm tmp`")],
        ]);
        expect(
            outcomesForMatchingGrants(grants, pending, "perm-13").map((match) => match.requestId),
        ).toEqual(["perm-10", "perm-11"]);
    });

    it("asks again for a different tool kind", () => {
        const grants: PermissionGrant[] = [{ scopeKey: "kind:execute", decision: "allow" }];
        const edit = permissionRequest("edit", "Edit `src/a.ts`");
        expect(stickyPermissionOutcome(grants, edit)).toBeUndefined();
    });
});
