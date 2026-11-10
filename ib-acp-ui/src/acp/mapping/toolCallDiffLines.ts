import type { ToolCallDiffRow } from "../../protocol/extensionHostMessages";

/**
 * Builds a line-oriented diff for UI (removed / added / context) from two text blobs.
 */

const maxDiffRows = 4000;

/** Unchanged lines kept before and after each edit. */
const diffContextLineCount = 3;

/**
 * Keeps each edit and a few unchanged lines around it.
 * Distant unchanged lines stay out of the preview.
 */
export function windowToolCallDiffRows(rows: readonly ToolCallDiffRow[]): ToolCallDiffRow[] {
    const keep = Array.from({ length: rows.length }, () => false);
    let anyChange = false;
    for (let index = 0; index < rows.length; index += 1) {
        if (rows[index]?.kind === "context") {
            continue;
        }
        anyChange = true;
        const start = Math.max(0, index - diffContextLineCount);
        const end = Math.min(rows.length - 1, index + diffContextLineCount);
        for (let cursor = start; cursor <= end; cursor += 1) {
            keep[cursor] = true;
        }
    }
    if (!anyChange) {
        return [...rows];
    }

    const windowed: ToolCallDiffRow[] = [];
    let skipped = false;
    for (let index = 0; index < rows.length; index += 1) {
        if (!keep[index]) {
            skipped = windowed.length > 0;
            continue;
        }
        if (skipped) {
            windowed.push({ kind: "context", text: "…" });
            skipped = false;
        }
        const row = rows[index];
        if (row !== undefined) {
            windowed.push(row);
        }
    }
    return windowed;
}

function isChangeRow(row: ToolCallDiffRow | undefined): boolean {
    return row?.kind === "added" || row?.kind === "removed";
}

function firstChangeOffset(
    rows: readonly ToolCallDiffRow[],
    start: number,
    length: number,
): number {
    const end = Math.min(rows.length, start + length);
    for (let index = start; index < end; index += 1) {
        if (isChangeRow(rows[index])) {
            return index - start;
        }
    }
    return length;
}

/**
 * Collapsed diff preview: pick a fixed-height window that shows edits, not file-start context.
 * Expanded views should pass the full `rows` array instead.
 */
export function previewDiffRows(
    rows: readonly ToolCallDiffRow[],
    maxRows: number,
): ToolCallDiffRow[] {
    if (maxRows <= 0 || rows.length === 0) {
        return [];
    }
    if (rows.length <= maxRows) {
        const firstChange = rows.findIndex((row) => isChangeRow(row));
        if (firstChange <= 0) {
            return [...rows];
        }
        let lastChange = rows.length - 1;
        while (lastChange > firstChange && !isChangeRow(rows[lastChange])) {
            lastChange -= 1;
        }
        const changeSpan = lastChange - firstChange + 1;
        if (changeSpan > maxRows) {
            return [...rows];
        }
        const previewStart = firstChange;
        const previewEnd = Math.min(rows.length, previewStart + maxRows);
        return rows.slice(previewStart, previewEnd);
    }

    let bestStart = 0;
    let bestLength = 0;
    let bestScore = -1;
    let bestLeadContext = maxRows;
    for (let start = 0; start < rows.length; start += 1) {
        const length = Math.min(maxRows, rows.length - start);
        if (length <= 0) {
            continue;
        }
        let score = 0;
        for (let index = start; index < start + length; index += 1) {
            if (isChangeRow(rows[index])) {
                score += 1;
            }
        }
        const leadContext = firstChangeOffset(rows, start, length);
        if (
            score > bestScore ||
            (score === bestScore &&
                score > 0 &&
                (leadContext < bestLeadContext ||
                    (leadContext === bestLeadContext && length > bestLength)))
        ) {
            bestScore = score;
            bestLeadContext = leadContext;
            bestStart = start;
            bestLength = length;
        }
    }

    if (bestScore <= 0) {
        const anchor = rows.findIndex((row) => isChangeRow(row));
        if (anchor >= 0) {
            const start = Math.max(0, Math.min(anchor, Math.max(0, rows.length - maxRows)));
            return rows.slice(start, start + Math.min(maxRows, rows.length - start));
        }
        return rows.slice(0, maxRows);
    }

    return rows.slice(bestStart, bestStart + Math.min(maxRows, rows.length - bestStart));
}

function splitLinesNormalized(text: string): string[] {
    const normalized = text.replace(/\r\n/g, "\n");
    if (normalized.length === 0) {
        return [];
    }
    const parts = normalized.split("\n");
    if (parts.length > 1 && parts[parts.length - 1] === "") {
        parts.pop();
    }
    return parts;
}

/**
 * Computes a Myers-style line diff (LCS backtrack) for git-style red/green presentation.
 */
export function computeToolCallDiffRows(oldText: string, newText: string): ToolCallDiffRow[] {
    const oldLines = splitLinesNormalized(oldText);
    const newLines = splitLinesNormalized(newText);
    const m = oldLines.length;
    const n = newLines.length;
    if (m === 0 && n === 0) {
        return [];
    }
    const lcs: number[][] = Array.from({ length: m + 1 }, () =>
        Array.from({ length: n + 1 }, () => 0),
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                lcs[i]![j] = lcs[i - 1]![j - 1]! + 1;
            } else {
                lcs[i]![j] = Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!);
            }
        }
    }
    const rows: ToolCallDiffRow[] = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
        if (rows.length >= maxDiffRows) {
            rows.unshift({
                kind: "context",
                text: "… (diff truncated for display)",
            });
            break;
        }
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            rows.unshift({ kind: "context", text: oldLines[i - 1]!, line: j });
            i -= 1;
            j -= 1;
        } else if (j > 0 && (i === 0 || lcs[i]![j - 1]! >= lcs[i - 1]![j]!)) {
            rows.unshift({ kind: "added", text: newLines[j - 1]!, line: j });
            j -= 1;
        } else if (i > 0) {
            rows.unshift({ kind: "removed", text: oldLines[i - 1]!, line: i });
            i -= 1;
        }
    }
    return windowToolCallDiffRows(rows);
}
