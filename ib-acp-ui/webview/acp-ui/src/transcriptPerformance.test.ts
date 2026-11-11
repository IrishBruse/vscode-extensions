import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { buildComposerAutocompleteState } from "./components/acp/composer/ChatComposer/composerAutocomplete";
import {
  highlightCodeBuildCount,
  highlightCodeToNodes,
} from "./components/acp/trace/AgentMarkdown/codeHighlighting";
import { AgentMarkdown } from "./components/acp/trace/AgentMarkdown/AgentMarkdown";
import { TraceList } from "./components/acp/trace/TraceList/TraceList";

function memoType(component: object): symbol | undefined {
  return (component as { $$typeof?: symbol }).$$typeof;
}

function workspaceFileReads(files: string[]): number {
  let reads = 0;
  const listed = new Proxy(files, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        reads += 1;
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  buildComposerAutocompleteState({
    draft: "@",
    caret: 1,
    slashCommands: [],
    workspaceFiles: listed,
  });
  return reads;
}

describe("long chat performance", () => {
  it("keeps composer typing and unchanged rows off the expensive transcript path", () => {
    const app = readFileSync(new URL("./AcpUiApp.tsx", import.meta.url), "utf8");
    expect(app).not.toContain('const [draft, setDraft] = useState("")');
    expect(memoType(TraceList)).toBe(Symbol.for("react.memo"));
    expect(memoType(AgentMarkdown)).toBe(Symbol.for("react.memo"));

    const files = Array.from({ length: 4000 }, (_, index) => `src/file-${index}.ts`);
    workspaceFileReads(files);
    expect(workspaceFileReads(files)).toBeLessThan(80);

    const beforeHighlight = highlightCodeBuildCount();
    void highlightCodeToNodes("typescript", "const value = 2;");
    void highlightCodeToNodes("typescript", "const value = 2;");
    expect(highlightCodeBuildCount()).toBe(beforeHighlight + 1);
  });
});
