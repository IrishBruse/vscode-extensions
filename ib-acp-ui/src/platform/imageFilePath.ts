/** Base64 character cap for one tool-result image kept on a chat row. */
export const maxToolImageDataChars = 6_000_000;

/** Byte cap when the host reads an image file for a preview. */
export const maxToolImageBytes = 4_000_000;

const imageMimeByExtension = new Map<string, string>([
    ["png", "image/png"],
    ["jpg", "image/jpeg"],
    ["jpeg", "image/jpeg"],
    ["gif", "image/gif"],
    ["webp", "image/webp"],
    ["bmp", "image/bmp"],
    ["ico", "image/x-icon"],
    ["avif", "image/avif"],
    ["svg", "image/svg+xml"],
]);

function imageExtension(path: string): string | undefined {
    const trimmed = path
        .trim()
        .replace(/\s+lines?\s+\d+(?:\s*-\s*\d+)?$/i, "")
        .replace(/\\/g, "/");
    const slash = trimmed.lastIndexOf("/");
    const base = slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
    const dot = base.lastIndexOf(".");
    if (dot <= 0 || dot === base.length - 1) {
        return undefined;
    }
    return base.slice(dot + 1).toLowerCase();
}

/** True when `path` names a raster or SVG file. */
export function isImageFilePath(path: string): boolean {
    const extension = imageExtension(path);
    return extension !== undefined && imageMimeByExtension.has(extension);
}

/** MIME type for an image path, when the extension is one this UI previews. */
export function imageMimeTypeForPath(path: string): string | undefined {
    const extension = imageExtension(path);
    if (extension === undefined) {
        return undefined;
    }
    return imageMimeByExtension.get(extension);
}
