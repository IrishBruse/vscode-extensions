import type { AcpUiPromptImage } from "../protocol/extensionHostMessages";
import { imageMimeTypeForPath, maxToolImageBytes } from "./imageFilePath";
import { resolveWorkspacePath } from "./resolveWorkspacePath";

/**
 * Reads an image file the agent opened and returns a preview payload.
 * Missing files, non-images, and files over the size cap yield undefined.
 */
export async function readWorkspaceImage(
    path: string,
    workspaceRoot: string | undefined,
    readBytes: (absolutePath: string) => Promise<Uint8Array>,
): Promise<AcpUiPromptImage | undefined> {
    const mimeType = imageMimeTypeForPath(path);
    if (mimeType === undefined) {
        return undefined;
    }
    const absolutePath = resolveWorkspacePath(path, workspaceRoot);
    let bytes: Uint8Array;
    try {
        bytes = await readBytes(absolutePath);
    } catch {
        return undefined;
    }
    if (bytes.byteLength === 0 || bytes.byteLength > maxToolImageBytes) {
        return undefined;
    }
    return { data: Buffer.from(bytes).toString("base64"), mimeType };
}
