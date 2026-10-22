import { platform } from "os";
import { asyncSpawn } from "../lib/asyncSpawn/asyncSpawn";

function mimeTypesIncludeImage(types: string): boolean {
    for (const line of types.split(/\r?\n/)) {
        for (const token of line.split(/\s+/)) {
            const mime = token.trim();
            if (mime.length !== 0 && mime.startsWith("image/")) {
                return true;
            }
        }
    }
    return false;
}

function macClipboardInfoHasImage(info: string): boolean {
    return /«class (PNGf|JPEG|GIFf|TIFF|PICT|BMPf)»/.test(info);
}

function linuxClipboardSpawnEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    const wayland = env.WAYLAND_DISPLAY;
    if (wayland === undefined || wayland.length === 0) {
        env.WAYLAND_DISPLAY = "wayland-0";
    }
    const runtimeDir = env.XDG_RUNTIME_DIR;
    if (runtimeDir === undefined || runtimeDir.length === 0) {
        const uid = process.getuid?.();
        if (uid !== undefined) {
            env.XDG_RUNTIME_DIR = `/run/user/${uid}`;
        }
    }
    return env;
}

async function linuxWlPasteHasImage(): Promise<boolean | null> {
    try {
        const { stdout, stderr, status } = await asyncSpawn("wl-paste", ["--list-types"], {
            env: linuxClipboardSpawnEnv(),
        });
        if (status !== 0) {
            return null;
        }
        return mimeTypesIncludeImage(stdout + stderr);
    } catch {
        return null;
    }
}

async function linuxX11ClipboardHasImage(): Promise<boolean | null> {
    const display = process.env.DISPLAY;
    if (display === undefined || display.length === 0) {
        return null;
    }
    try {
        const { stdout, stderr, status } = await asyncSpawn(
            "xclip",
            ["-selection", "clipboard", "-t", "TARGETS", "-o"],
            { env: process.env },
        );
        if (status !== 0) {
            return null;
        }
        return mimeTypesIncludeImage(stdout + stderr);
    } catch {
        return null;
    }
}

async function linuxClipboardHasImage(): Promise<boolean | null> {
    const wayland = await linuxWlPasteHasImage();
    if (wayland !== null) {
        return wayland;
    }
    return linuxX11ClipboardHasImage();
}

async function macClipboardHasImage(): Promise<boolean | null> {
    try {
        const { stdout, stderr, status } = await asyncSpawn("osascript", ["-e", "clipboard info"]);
        if (status !== 0) {
            return null;
        }
        return macClipboardInfoHasImage(stdout + stderr);
    } catch {
        return null;
    }
}

export async function clipboardHasImage(): Promise<boolean | null> {
    const os = platform();
    if (os === "darwin") {
        return macClipboardHasImage();
    }
    if (os === "linux") {
        return linuxClipboardHasImage();
    }
    return false;
}
