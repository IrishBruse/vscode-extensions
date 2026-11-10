import type * as acp from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vite-plus/test";
import {
    type PermissionGrant,
    grantForSelectedOption,
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

    it("asks again for a different tool kind", () => {
        const grants: PermissionGrant[] = [{ scopeKey: "kind:execute", decision: "allow" }];
        const edit = permissionRequest("edit", "Edit `src/a.ts`");
        expect(stickyPermissionOutcome(grants, edit)).toBeUndefined();
    });
});
