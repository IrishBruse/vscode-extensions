import { describe, expect, it } from "vite-plus/test";
import type { TraceItem, TraceToolItem } from "./chatReducer";

function toolItem(toolCallId: string, kind: TraceToolItem["kind"] = "read"): TraceToolItem {
  return {
    type: "tool",
    toolCallId,
    title: "Tool",
    kind,
    subtitle: `${toolCallId}.ts`,
    status: "completed",
    content: undefined,
    diffRows: undefined,
    detailVisible: false,
  };
}

/** Mirrors TraceList partition rules for unit testing. */
function partitionToolSegmentKinds(items: TraceItem[]): string[] {
  const kinds: string[] = [];
  for (const item of items) {
    if (item.type !== "tool") {
      kinds.push(item.type);
      continue;
    }
    const separate = item.kind === "execute" || item.kind === "terminal";
    if (separate) {
      kinds.push(`execute:${item.toolCallId}`);
      continue;
    }
    kinds.push(`compact:${item.toolCallId}`);
  }
  return kinds;
}

describe("TraceList tool partitioning", () => {
  const reads = [toolItem("read-1"), toolItem("read-2"), toolItem("read-3"), toolItem("read-4")];

  it("emits one compact line per read", () => {
    expect(partitionToolSegmentKinds(reads)).toEqual([
      "compact:read-1",
      "compact:read-2",
      "compact:read-3",
      "compact:read-4",
    ]);
  });

  it("keeps execute tools on their own row", () => {
    const items: TraceItem[] = [
      toolItem("read-1"),
      toolItem("run-1", "execute"),
      toolItem("read-2"),
    ];
    expect(partitionToolSegmentKinds(items)).toEqual([
      "compact:read-1",
      "execute:run-1",
      "compact:read-2",
    ]);
  });
});
