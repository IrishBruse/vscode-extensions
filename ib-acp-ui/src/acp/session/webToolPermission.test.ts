import type * as acp from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vite-plus/test";
import { autoApproveWebToolOption, isWebFetchOrSearchTool } from "./webToolPermission";

const options: acp.PermissionOption[] = [
    { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
    { optionId: "allow-always", name: "Allow always", kind: "allow_always" },
    { optionId: "reject-once", name: "Reject", kind: "reject_once" },
];

function request(toolCall: acp.ToolCallUpdate): acp.RequestPermissionRequest {
    return { sessionId: "sess-1", toolCall, options };
}

describe("isWebFetchOrSearchTool", () => {
    it("matches web fetch and web search titles", () => {
        expect(
            isWebFetchOrSearchTool({
                toolCallId: "fetch-1",
                title: "Web Fetch",
                status: "pending",
            }),
        ).toBe(true);
        expect(
            isWebFetchOrSearchTool({
                toolCallId: "search-1",
                title: "Web search: recomp launcher",
                status: "pending",
            }),
        ).toBe(true);
    });

    it("leaves file search and grep alone", () => {
        expect(
            isWebFetchOrSearchTool({
                toolCallId: "grep-1",
                kind: "search",
                title: "Grep",
                status: "pending",
            }),
        ).toBe(false);
        expect(
            isWebFetchOrSearchTool({
                toolCallId: "edit-1",
                kind: "edit",
                title: "Write File",
                status: "pending",
            }),
        ).toBe(false);
    });
});

describe("autoApproveWebToolOption", () => {
    it("picks Allow once for a web fetch", () => {
        const option = autoApproveWebToolOption(
            request({
                toolCallId: "fetch-1",
                title: "Web Fetch",
                status: "pending",
                rawInput: { toolName: "WebFetch", url: "https://example.com" },
            }),
        );
        expect(option?.optionId).toBe("allow-once");
    });

    it("uses Allow always when that is the only allow option", () => {
        const option = autoApproveWebToolOption({
            sessionId: "sess-1",
            toolCall: {
                toolCallId: "search-1",
                title: "Web search",
                status: "pending",
                rawInput: { toolName: "web_search" },
            },
            options: [{ optionId: "allow-always", name: "Allow always", kind: "allow_always" }],
        });
        expect(option?.optionId).toBe("allow-always");
    });

    it("does not pick an option for a file edit", () => {
        expect(
            autoApproveWebToolOption(
                request({
                    toolCallId: "edit-1",
                    kind: "edit",
                    title: "Write File",
                    status: "pending",
                }),
            ),
        ).toBeUndefined();
    });
});
