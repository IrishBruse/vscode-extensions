import type { CursorContext } from "../../document/types";
import { blockquoteContentIndex, blockquoteLineDepth } from "./style";

export const alertKinds = ["note", "tip", "important", "warning", "caution"] as const;

export type AlertKind = (typeof alertKinds)[number];

export interface QuoteAlert {
    readonly kind: AlertKind;
    readonly from: number;
    readonly to: number;
    readonly label: string;
}

const labels: Record<AlertKind, string> = {
    note: "Note",
    tip: "Tip",
    important: "Important",
    warning: "Warning",
    caution: "Caution",
};

const alertLine = /^\[!(note|tip|important|warning|caution)\]/i;

export function alertClass(kind: AlertKind): string {
    return `inline-md-alert-${kind}`;
}

export function quoteAlert(line: string): QuoteAlert | undefined {
    if (blockquoteLineDepth(line) < 1) {
        return undefined;
    }
    const from = blockquoteContentIndex(line);
    const match = alertLine.exec(line.slice(from));
    const token = match?.[1];
    if (!match || !token) {
        return undefined;
    }
    const rest = line.slice(from + match[0].length);
    if (rest.trim().length > 0) {
        return undefined;
    }
    const kind = token.toLowerCase() as AlertKind;
    return {
        kind,
        from,
        to: from + match[0].length,
        label: labels[kind],
    };
}

export function cursorCoversAlert(
    alert: QuoteAlert,
    lineStart: number,
    cursor: CursorContext,
): boolean {
    const start = lineStart + alert.from;
    const end = lineStart + alert.to;
    const from = Math.min(cursor.selectionFrom, cursor.selectionTo);
    const to = Math.max(cursor.selectionFrom, cursor.selectionTo);
    if (from === to) {
        return from >= start && from < end;
    }
    return from < end && to > start;
}
