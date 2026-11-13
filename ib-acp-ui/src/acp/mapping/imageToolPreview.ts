import type { ExtensionToWebviewMessage } from "../../protocol/extensionHostMessages";
import { isImageFilePath } from "../../platform/imageFilePath";

export type ImagePreviewTarget = {
    toolCallId: string;
    path: string;
    sessionId?: string;
};

/**
 * A read of an image path that did not already include image bytes.
 * Child-session tool rows keep the child session id so the preview lands on that trace.
 */
export function imagePreviewTargetFromMessage(
    message: ExtensionToWebviewMessage,
    sessionId?: string,
): ImagePreviewTarget | undefined {
    if (message.type === "subagentActivity") {
        return imagePreviewTargetFromMessage(message.event, message.sessionId);
    }
    if (message.type !== "appendToolCall" && message.type !== "updateToolCall") {
        return undefined;
    }
    if (message.image !== undefined) {
        return undefined;
    }
    if (message.kind !== undefined && message.kind !== "read") {
        return undefined;
    }
    const path = message.subtitle?.trim() ?? "";
    if (!isImageFilePath(path)) {
        return undefined;
    }
    return {
        toolCallId: message.toolCallId,
        path,
        ...(sessionId !== undefined && sessionId.length > 0 ? { sessionId } : {}),
    };
}
