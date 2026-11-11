import { describe, expect, it } from "vite-plus/test";
import { formatListeningPort } from "./formatListeningPort";
import type { ListeningPort } from "./listListeningPorts";

function port(partial: Partial<ListeningPort> & Pick<ListeningPort, "port">): ListeningPort {
    return {
        address: `127.0.0.1:${partial.port}`,
        label: "",
        ...partial,
    };
}

describe("formatListeningPort", () => {
    it("shows the page title, folder, process, and address", () => {
        expect(
            formatListeningPort(
                port({
                    port: 5175,
                    pid: 4653,
                    processName: "MainThread",
                    label: "markdownInline",
                    cwd: "/home/econn/git/vscode-extensions/inline-markdown-editor",
                    title: "Inline Markdown",
                    website: true,
                }),
            ),
        ).toEqual({
            label: "Inline Markdown",
            description: "5175 · markdownInline · MainThread · 127.0.0.1",
            tooltip: [
                "Inline Markdown",
                "http://localhost:5175",
                "Port 5175",
                "Address 127.0.0.1:5175",
                "Process MainThread",
                "PID 4653",
                "/home/econn/git/vscode-extensions/inline-markdown-editor",
            ].join("\n"),
        });
    });

    it("shows a port that has no process", () => {
        expect(
            formatListeningPort(
                port({
                    port: 631,
                    address: "127.0.0.1:631",
                }),
            ),
        ).toEqual({
            label: "631",
            description: "127.0.0.1",
            tooltip: ["http://localhost:631", "Port 631", "Address 127.0.0.1:631"].join("\n"),
        });
    });
});
