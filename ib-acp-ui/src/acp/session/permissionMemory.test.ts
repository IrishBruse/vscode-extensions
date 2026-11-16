import type * as acp from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vite-plus/test";
import {
    type PermissionGrant,
    enrichPermissionRequest,
    grantForSelectedOption,
    outcomesForMatchingGrants,
    permissionScopeKey,
    stickyPermissionOutcome,
} from "./permissionMemory";

const allowOptions: acp.PermissionOption[] = [
    { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
    { optionId: "allow-always", name: "Allow always", kind: "allow_always" },
    { optionId: "reject-once", name: "Reject", kind: "reject_once" },
];

function permissionRequest(
    toolCall: acp.ToolCallUpdate,
    options: acp.PermissionOption[] = allowOptions,
): acp.RequestPermissionRequest {
    return {
        sessionId: "sess-1",
        toolCall,
        options,
    };
}

describe("sticky permission", () => {
    it("approves a later request of the same tool kind after Allow always", () => {
        const first = permissionRequest({
            toolCallId: "call-1",
            kind: "execute",
            title: "`git status`",
            status: "pending",
        });
        const grant = grantForSelectedOption(first, "allow-always");
        expect(grant).toEqual({ scopeKey: "kind:execute", decision: "allow" });
        const grants: PermissionGrant[] = grant === undefined ? [] : [grant];
        const second = permissionRequest({
            toolCallId: "call-2",
            kind: "execute",
            title: "`npm test`",
            status: "pending",
        });
        expect(stickyPermissionOutcome(grants, second)).toEqual({
            outcome: { outcome: "selected", optionId: "allow-always" },
        });
    });

    it("asks again after Allow once", () => {
        const first = permissionRequest({
            toolCallId: "call-1",
            kind: "execute",
            title: "`git status`",
            status: "pending",
        });
        expect(grantForSelectedOption(first, "allow-once")).toBeUndefined();
    });

    it("answers other waiting requests of that tool kind", () => {
        const grants: PermissionGrant[] = [{ scopeKey: "kind:edit", decision: "allow" }];
        const pending = new Map<string, acp.RequestPermissionRequest>([
            [
                "perm-10",
                permissionRequest({
                    toolCallId: "call-10",
                    kind: "edit",
                    title: "Delete `left.png`",
                    status: "pending",
                }),
            ],
            [
                "perm-11",
                permissionRequest({
                    toolCallId: "call-11",
                    kind: "edit",
                    title: "Delete `right.png`",
                    status: "pending",
                }),
            ],
            [
                "perm-13",
                permissionRequest({
                    toolCallId: "call-13",
                    kind: "edit",
                    title: "Delete `lower.png`",
                    status: "pending",
                }),
            ],
            [
                "perm-14",
                permissionRequest({
                    toolCallId: "call-14",
                    kind: "execute",
                    title: "`rm tmp`",
                    status: "pending",
                }),
            ],
        ]);
        expect(
            outcomesForMatchingGrants(grants, pending, "perm-13").map((match) => match.requestId),
        ).toEqual(["perm-10", "perm-11"]);
    });

    it("asks again for a different tool kind", () => {
        const grants: PermissionGrant[] = [{ scopeKey: "kind:execute", decision: "allow" }];
        const edit = permissionRequest({
            toolCallId: "call-edit",
            kind: "edit",
            title: "Edit `src/a.ts`",
            status: "pending",
        });
        expect(stickyPermissionOutcome(grants, edit)).toBeUndefined();
    });

    it("remembers delete by kind when the agent omits kind on the permission request", () => {
        const path =
            "Delete `/home/econn/git/vscode-extensions/ib-acp-ui/src/extension/acpUiChatOverview.test.ts`";
        const first = permissionRequest({
            toolCallId: "call-del-1",
            title: path,
            status: "pending",
        });
        const grant = grantForSelectedOption(first, "allow-always");
        expect(grant).toEqual({ scopeKey: "kind:delete", decision: "allow" });
        const grants: PermissionGrant[] = grant === undefined ? [] : [grant];
        const second = permissionRequest({
            toolCallId: "call-del-2",
            title: "Delete `/home/econn/git/vscode-extensions/ib-acp-ui/src/extension/acpUiNewChatAgentCommands.ts`",
            status: "pending",
        });
        expect(stickyPermissionOutcome(grants, second)).toEqual({
            outcome: { outcome: "selected", optionId: "allow-always" },
        });
    });

    it("uses the tracked kind from the live tool row when the permission omits kind", () => {
        const title = "Delete `/tmp/other.ts`";
        const first = permissionRequest({
            toolCallId: "call-del-1",
            title,
            status: "pending",
        });
        expect(permissionScopeKey(first.toolCall, "delete")).toBe("kind:delete");
        const grant = grantForSelectedOption(first, "allow-always", "delete");
        expect(grant).toEqual({ scopeKey: "kind:delete", decision: "allow" });
        const grants: PermissionGrant[] = grant === undefined ? [] : [grant];
        const second = permissionRequest({
            toolCallId: "call-del-2",
            title: "Delete `/tmp/another.ts`",
            status: "pending",
        });
        expect(stickyPermissionOutcome(grants, second, "delete")).toEqual({
            outcome: { outcome: "selected", optionId: "allow-always" },
        });
    });

    it("stores Allow always when the agent omits option kind but keeps the label", () => {
        const options: acp.PermissionOption[] = [
            { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
            { optionId: "allow-always", name: "Allow always", kind: "allow_once" },
            { optionId: "reject", name: "Reject", kind: "reject_once" },
        ];
        const request = permissionRequest(
            {
                toolCallId: "call-del",
                kind: "delete",
                title: "Delete `src/a.ts`",
                status: "pending",
            },
            options,
        );
        expect(grantForSelectedOption(request, "allow-always")).toEqual({
            scopeKey: "kind:delete",
            decision: "allow",
        });
    });

    it("fills kind on the permission toolCall before scoping", () => {
        const request = permissionRequest({
            toolCallId: "call-1",
            title: "Delete `src/a.ts`",
            status: "pending",
        });
        expect(enrichPermissionRequest(request).toolCall.kind).toBe("delete");
    });
});
