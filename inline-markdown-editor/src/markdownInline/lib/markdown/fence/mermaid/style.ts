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
    lineNumbers: readonly number[],
    host: BlockZoneHost,
): BlockZoneRecord {
    return createMermaidZoneFromPreview(scope, content, key, lineNumbers, host);
}
