import {
  compareSlashCommandGroups,
  normalizeSlashCommand,
  parseTrailingParenLabels,
  slashCommandGroupLabel,
} from "../../../../../../../src/acp/slashCommandMetadata";

export type ComposerSuggestionItem = {
  key: string;
  primary: string;
  secondary?: string;
  source?: string;
  insertText: string;
};

export type ComposerSuggestionGroup = {
  label?: string;
  items: ComposerSuggestionItem[];
};

export type ComposerAutocompleteState = {
  mode: "slash" | "file";
  query: string;
  groups: ComposerSuggestionGroup[];
  items: ComposerSuggestionItem[];
  activeIndex: number;
};

function formatPathMention(path: string): string {
  return /[\s\n"]/.test(path) ? `@"${path.replace(/"/g, '\\"')}"` : `@${path}`;
}

function queryFromCaret(draft: string, caret: number, prefix: "/" | "@"): string | null {
  const left = draft.slice(0, caret);
  const lineStart = left.lastIndexOf("\n") + 1;
  const fragment = left.slice(lineStart);
  const escaped = prefix === "/" ? "\\/" : "@";
  const match = fragment.match(new RegExp(`(?:^|\\s)${escaped}([^\\s]*)$`));
  if (match === null) {
    return null;
  }
  return match[1] ?? "";
}

function slashSuggestionItem(command: {
  name: string;
  description: string;
  source?: string;
}): ComposerSuggestionItem {
  const normalized = normalizeSlashCommand(command);
  return {
    key: `slash:${command.name}`,
    primary: `/${command.name}`,
    secondary: normalized.description,
    ...(normalized.source !== undefined ? { source: normalized.source } : {}),
    insertText: `/${command.name} `,
  };
}

function groupSlashSuggestionItems(items: ComposerSuggestionItem[]): ComposerSuggestionGroup[] {
  const grouped = new Map<string, ComposerSuggestionItem[]>();
  for (const item of items) {
    const label = slashCommandGroupLabel(item.source);
    const bucket = grouped.get(label);
    if (bucket === undefined) {
      grouped.set(label, [item]);
      continue;
    }
    bucket.push(item);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => compareSlashCommandGroups(left, right))
    .map(([label, groupItems]) => ({
      label: label === "Built-in" ? undefined : label,
      items: groupItems.sort((left, right) =>
        left.primary.localeCompare(right.primary, undefined, {
          sensitivity: "base",
        }),
      ),
    }));
}

export function buildComposerAutocompleteState(args: {
  draft: string;
  caret: number;
  slashCommands: Array<{ name: string; description: string; source?: string }>;
  workspaceFiles: string[];
}): ComposerAutocompleteState | null {
  const slashQuery = queryFromCaret(args.draft, args.caret, "/");
  if (slashQuery !== null) {
    const queryLower = slashQuery.toLowerCase();
    const items = args.slashCommands
      .filter((command) => command.name.toLowerCase().startsWith(queryLower))
      .map((command) => slashSuggestionItem(command));
    const groups = groupSlashSuggestionItems(items);
    return items.length > 0
      ? { mode: "slash", query: slashQuery, groups, items, activeIndex: 0 }
      : null;
  }
  const fileQuery = queryFromCaret(args.draft, args.caret, "@");
  if (fileQuery === null) {
    return null;
  }
  const queryLower = fileQuery.toLowerCase();
  const items = workspaceFileSuggestions(args.workspaceFiles, queryLower);
  return items.length > 0
    ? {
        mode: "file",
        query: fileQuery,
        groups: [{ items }],
        items,
        activeIndex: 0,
      }
    : null;
}

const fileSuggestionLimit = 30;

type IndexedWorkspaceFile = { raw: string; lower: string };

let indexedWorkspaceFiles: IndexedWorkspaceFile[] | null = null;
let indexedWorkspaceFileSource: readonly string[] | null = null;

function fileSuggestion(filePath: string): ComposerSuggestionItem {
  return {
    key: `file:${filePath}`,
    primary: filePath,
    insertText: `${formatPathMention(filePath)} `,
  };
}

/** Returns at most 30 path matches and stops early once that many are found. */
function workspaceFileSuggestions(
  files: readonly string[],
  queryLower: string,
): ComposerSuggestionItem[] {
  const items: ComposerSuggestionItem[] = [];
  const indexed = indexedWorkspaceFileSource === files ? indexedWorkspaceFiles : null;
  if (indexed !== null) {
    for (let i = 0; i < indexed.length && items.length < fileSuggestionLimit; i++) {
      const file = indexed[i]!;
      if (file.lower.includes(queryLower)) {
        items.push(fileSuggestion(file.raw));
      }
    }
    return items;
  }
  const built: IndexedWorkspaceFile[] = [];
  let scannedAll = true;
  for (let i = 0; i < files.length; i++) {
    const raw = files[i] ?? "";
    const lower = raw.toLowerCase();
    built.push({ raw, lower });
    if (lower.includes(queryLower) && items.length < fileSuggestionLimit) {
      items.push(fileSuggestion(raw));
    }
    if (items.length >= fileSuggestionLimit && i < files.length - 1) {
      scannedAll = false;
      break;
    }
  }
  if (scannedAll) {
    indexedWorkspaceFileSource = files;
    indexedWorkspaceFiles = built;
  }
  return items;
}

export function wrapIndex(index: number, size: number): number {
  if (size <= 0) {
    return 0;
  }
  const mod = index % size;
  return mod < 0 ? mod + size : mod;
}

export { normalizeSlashCommand, parseTrailingParenLabels, slashCommandGroupLabel };
