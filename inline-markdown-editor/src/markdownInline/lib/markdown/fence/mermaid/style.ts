import {
    createMermaidZone as createMermaidZoneFromPreview,
    type BlockZoneHost,
    type BlockZoneRecord,
} from "../../../preview/blockZone";
import type { Scope } from "../../../document/types";

export function createMermaidZone(
    scope: Scope,
    content: string,
    key: string,
    lineNumber: number,
    host: BlockZoneHost,
    lineCount = 1,
): BlockZoneRecord {
    return createMermaidZoneFromPreview(scope, content, key, lineNumber, host, lineCount);
}
