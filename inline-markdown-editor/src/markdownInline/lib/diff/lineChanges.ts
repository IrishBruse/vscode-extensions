export interface ColumnSpan {
    readonly line: number;
    readonly startColumn: number;
    readonly endColumn: number;
}

export interface DeletedBlock {
    readonly beforeLine: number;
    readonly text: string;
}

export interface SideChanges {
    readonly lines: readonly number[];
    readonly inner: readonly ColumnSpan[];
}

export interface TextLineChanges {
    readonly original: SideChanges;
    readonly modified: SideChanges;
    readonly removedBlocks: readonly DeletedBlock[];
    readonly originalToModified: readonly number[];
    readonly modifiedToOriginal: readonly number[];
}

export interface DiffPaint {
    readonly kind: "added" | "removed";
    readonly lines: readonly number[];
    readonly inner: readonly ColumnSpan[];
    readonly removedBlocks: readonly DeletedBlock[];
}

interface LineOp {
    readonly kind: "eq" | "del" | "ins";
    readonly text: string;
}

const cellCap = 1_000_000;

function linesOf(text: string): string[] {
    const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
    if (normalized.length === 0) {
        return [""];
    }
    return normalized.split("\n");
}

function commonPrefix(left: readonly string[], right: readonly string[]): number {
    const count = Math.min(left.length, right.length);
    let index = 0;
    while (index < count && left[index] === right[index]) {
        index += 1;
    }
    return index;
}

function commonSuffix(left: readonly string[], right: readonly string[], prefix: number): number {
    let count = 0;
    while (
        count < left.length - prefix &&
        count < right.length - prefix &&
        left[left.length - 1 - count] === right[right.length - 1 - count]
    ) {
        count += 1;
    }
    return count;
}

function lcsDiff(left: readonly string[], right: readonly string[]): LineOp[] {
    const rows = left.length;
    const columns = right.length;
    const scores: number[][] = Array.from({ length: rows + 1 }, () =>
        Array.from({ length: columns + 1 }, () => 0),
    );
    for (let row = rows - 1; row >= 0; row -= 1) {
        const current = scores[row];
        const below = scores[row + 1];
        if (!current || !below) {
            continue;
        }
        for (let column = columns - 1; column >= 0; column -= 1) {
            current[column] =
                left[row] === right[column]
                    ? (below[column + 1] ?? 0) + 1
                    : Math.max(below[column] ?? 0, current[column + 1] ?? 0);
        }
    }
    const ops: LineOp[] = [];
    let row = 0;
    let column = 0;
    while (row < rows && column < columns) {
        if (left[row] === right[column]) {
            ops.push({ kind: "eq", text: left[row] ?? "" });
            row += 1;
            column += 1;
            continue;
        }
        const dropLeft = scores[row + 1]?.[column] ?? 0;
        const dropRight = scores[row]?.[column + 1] ?? 0;
        if (dropLeft >= dropRight) {
            ops.push({ kind: "del", text: left[row] ?? "" });
            row += 1;
        } else {
            ops.push({ kind: "ins", text: right[column] ?? "" });
            column += 1;
        }
    }
    while (row < rows) {
        ops.push({ kind: "del", text: left[row] ?? "" });
        row += 1;
    }
    while (column < columns) {
        ops.push({ kind: "ins", text: right[column] ?? "" });
        column += 1;
    }
    return ops;
}

function replaceDiff(left: readonly string[], right: readonly string[]): LineOp[] {
    return [
        ...left.map((text) => ({ kind: "del" as const, text })),
        ...right.map((text) => ({ kind: "ins" as const, text })),
    ];
}

function diffLines(left: readonly string[], right: readonly string[]): LineOp[] {
    const prefix = commonPrefix(left, right);
    const suffix = commonSuffix(left, right, prefix);
    const leftMid = left.slice(prefix, left.length - suffix);
    const rightMid = right.slice(prefix, right.length - suffix);
    const mid =
        leftMid.length * rightMid.length > cellCap
            ? replaceDiff(leftMid, rightMid)
            : lcsDiff(leftMid, rightMid);
    return [
        ...left.slice(0, prefix).map((text) => ({ kind: "eq" as const, text })),
        ...mid,
        ...left.slice(left.length - suffix).map((text) => ({ kind: "eq" as const, text })),
    ];
}

function codeUnits(text: string): string[] {
    const units: string[] = [];
    for (let index = 0; index < text.length; index += 1) {
        units.push(text.charAt(index));
    }
    return units;
}

function columnSpans(
    before: string,
    after: string,
    line: number,
    side: "del" | "ins",
): ColumnSpan[] {
    const ops = lcsDiff(codeUnits(before), codeUnits(after));
    const spans: ColumnSpan[] = [];
    let column = 0;
    let start = -1;
    const finish = (): void => {
        if (start >= 0 && column > start) {
            spans.push({ line, startColumn: start, endColumn: column });
        }
        start = -1;
    };
    for (const op of ops) {
        if (op.kind === "eq") {
            finish();
            column += 1;
            continue;
        }
        if (op.kind !== side) {
            continue;
        }
        if (start < 0) {
            start = column;
        }
        column += 1;
    }
    finish();
    return spans;
}

function coversLine(spans: readonly ColumnSpan[], length: number): boolean {
    return spans.length === 1 && spans[0]?.startColumn === 0 && spans[0]?.endColumn === length;
}

function replacesWholeLine(
    before: string,
    after: string,
    deleted: readonly ColumnSpan[],
    inserted: readonly ColumnSpan[],
): boolean {
    if (before.length === 0 || after.length === 0) {
        return true;
    }
    return coversLine(inserted, after.length) && coversLine(deleted, before.length);
}

function mapLine(line: number, count: number): number {
    if (count <= 0) {
        return 0;
    }
    return Math.max(0, Math.min(line, count - 1));
}

export function textLineChanges(originalText: string, modifiedText: string): TextLineChanges {
    const originalLines = linesOf(originalText);
    const modifiedLines = linesOf(modifiedText);
    const ops = diffLines(originalLines, modifiedLines);
    const original: number[] = [];
    const modified: number[] = [];
    const originalInner: ColumnSpan[] = [];
    const modifiedInner: ColumnSpan[] = [];
    const removedBlocks: DeletedBlock[] = [];
    const originalToModified = Array.from({ length: originalLines.length }, () => 0);
    const modifiedToOriginal = Array.from({ length: modifiedLines.length }, () => 0);
    let originalIndex = 0;
    let modifiedIndex = 0;
    let cursor = 0;
    while (cursor < ops.length) {
        const op = ops[cursor];
        if (!op) {
            break;
        }
        if (op.kind === "eq") {
            originalToModified[originalIndex] = mapLine(modifiedIndex, modifiedLines.length);
            modifiedToOriginal[modifiedIndex] = mapLine(originalIndex, originalLines.length);
            originalIndex += 1;
            modifiedIndex += 1;
            cursor += 1;
            continue;
        }
        const deleted: string[] = [];
        const inserted: string[] = [];
        while (cursor < ops.length && ops[cursor]?.kind !== "eq") {
            const next = ops[cursor];
            if (!next) {
                break;
            }
            if (next.kind === "del") {
                deleted.push(next.text);
            } else {
                inserted.push(next.text);
            }
            cursor += 1;
        }
        if (deleted.length > 0 && deleted.length === inserted.length) {
            for (let pair = 0; pair < deleted.length; pair += 1) {
                const before = deleted[pair] ?? "";
                const after = inserted[pair] ?? "";
                const originalLine = originalIndex + pair;
                const modifiedLine = modifiedIndex + pair;
                originalToModified[originalLine] = mapLine(modifiedLine, modifiedLines.length);
                modifiedToOriginal[modifiedLine] = mapLine(originalLine, originalLines.length);
                const deletedSpans = columnSpans(before, after, originalLine, "del");
                const insertedSpans = columnSpans(before, after, modifiedLine, "ins");
                if (replacesWholeLine(before, after, deletedSpans, insertedSpans)) {
                    original.push(originalLine);
                    modified.push(modifiedLine);
                    continue;
                }
                originalInner.push(...deletedSpans);
                modifiedInner.push(...insertedSpans);
            }
        } else {
            if (deleted.length > 0) {
                removedBlocks.push({
                    beforeLine: modifiedIndex,
                    text: deleted.join("\n"),
                });
            }
            for (let pair = 0; pair < deleted.length; pair += 1) {
                const originalLine = originalIndex + pair;
                original.push(originalLine);
                originalToModified[originalLine] = mapLine(modifiedIndex, modifiedLines.length);
            }
            for (let pair = 0; pair < inserted.length; pair += 1) {
                const modifiedLine = modifiedIndex + pair;
                modified.push(modifiedLine);
                modifiedToOriginal[modifiedLine] = mapLine(originalIndex, originalLines.length);
            }
        }
        originalIndex += deleted.length;
        modifiedIndex += inserted.length;
    }
    return {
        original: { lines: original, inner: originalInner },
        modified: { lines: modified, inner: modifiedInner },
        removedBlocks,
        originalToModified,
        modifiedToOriginal,
    };
}

export function paintForModified(changes: TextLineChanges, showRemoved: boolean): DiffPaint {
    return {
        kind: "added",
        lines: changes.modified.lines,
        inner: changes.modified.inner,
        removedBlocks: showRemoved ? changes.removedBlocks : [],
    };
}

export function paintForOriginal(changes: TextLineChanges): DiffPaint {
    return {
        kind: "removed",
        lines: changes.original.lines,
        inner: changes.original.inner,
        removedBlocks: [],
    };
}
