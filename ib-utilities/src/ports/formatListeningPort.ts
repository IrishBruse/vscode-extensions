import type { ListeningPort } from "./listListeningPorts";
import { listeningHttpUrl } from "./listeningHttpUrl";

export type ListeningPortText = {
    label: string;
    description: string;
    tooltip: string;
};

export function formatListeningPort(port: ListeningPort): ListeningPortText {
    const name = port.label.trim();
    const title = port.title?.trim() ?? "";
    const processName = port.processName?.trim() ?? "";
    const host = hostFromAddress(port.address, port.port);
    const label = title || name || processName || String(port.port);

    const description = uniqueParts([
        label === String(port.port) ? undefined : String(port.port),
        name,
        processName,
        host,
    ]).filter((part) => part !== label);

    const tooltip = [
        title || undefined,
        listeningHttpUrl(port.address, port.port),
        `Port ${port.port}`,
        port.address ? `Address ${port.address}` : undefined,
        processName ? `Process ${processName}` : undefined,
        port.pid !== undefined ? `PID ${port.pid}` : undefined,
        port.cwd,
    ]
        .filter((line): line is string => Boolean(line))
        .join("\n");

    return {
        label,
        description: description.join(" · "),
        tooltip,
    };
}

function uniqueParts(parts: Array<string | undefined>): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const part of parts) {
        const text = part?.trim();
        if (!text || seen.has(text)) {
            continue;
        }
        seen.add(text);
        result.push(text);
    }
    return result;
}

function hostFromAddress(address: string, port: number): string {
    const suffix = `:${port}`;
    if (address.endsWith(suffix)) {
        return address.slice(0, -suffix.length);
    }
    return address;
}
