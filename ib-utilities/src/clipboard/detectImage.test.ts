/// <reference types="node" />

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("os", () => ({
    platform: vi.fn(() => "linux"),
}));

vi.mock("../lib/asyncSpawn/asyncSpawn", () => ({
    asyncSpawn: vi.fn(),
}));

import { platform } from "os";
import { asyncSpawn } from "../lib/asyncSpawn/asyncSpawn";
import { clipboardHasImage } from "./detectImage";

const mockPlatform = vi.mocked(platform);
const mockAsyncSpawn = vi.mocked(asyncSpawn);

describe("clipboardHasImage", () => {
    beforeEach(() => {
        mockAsyncSpawn.mockReset();
        mockPlatform.mockReturnValue("linux");
        delete process.env.WAYLAND_DISPLAY;
        delete process.env.XDG_SESSION_TYPE;
        delete process.env.DISPLAY;
        delete process.env.XDG_RUNTIME_DIR;
    });

    it("uses wl-paste with a Wayland runtime when the host env omits Wayland variables", async () => {
        const uid = process.getuid?.() ?? 0;
        mockAsyncSpawn.mockResolvedValueOnce({ stdout: "image/png\n", stderr: "", status: 0 });

        await expect(clipboardHasImage()).resolves.toBe(true);

        expect(mockAsyncSpawn).toHaveBeenCalledWith(
            "wl-paste",
            ["--list-types"],
            expect.objectContaining({
                env: expect.objectContaining({
                    WAYLAND_DISPLAY: "wayland-0",
                    XDG_RUNTIME_DIR: `/run/user/${uid}`,
                }),
            }),
        );
    });

    it("returns false when wl-paste reports non-image types", async () => {
        mockAsyncSpawn.mockResolvedValueOnce({ stdout: "text/plain\n", stderr: "", status: 0 });

        await expect(clipboardHasImage()).resolves.toBe(false);
    });

    it("falls back to xclip on X11 when wl-paste is unavailable", async () => {
        process.env.DISPLAY = ":1";
        mockAsyncSpawn.mockRejectedValueOnce(new Error("wl-paste missing"));
        mockAsyncSpawn.mockResolvedValueOnce({ stdout: "image/png\n", stderr: "", status: 0 });

        await expect(clipboardHasImage()).resolves.toBe(true);

        expect(mockAsyncSpawn).toHaveBeenNthCalledWith(
            2,
            "xclip",
            ["-selection", "clipboard", "-t", "TARGETS", "-o"],
            expect.objectContaining({ env: expect.objectContaining({ DISPLAY: ":1" }) }),
        );
    });
});
