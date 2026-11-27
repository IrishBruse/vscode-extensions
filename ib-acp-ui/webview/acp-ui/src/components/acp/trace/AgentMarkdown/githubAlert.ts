const alertKinds = ["note", "tip", "important", "warning", "caution"] as const;

export type GithubAlertKind = (typeof alertKinds)[number];

type MdText = { type: "text"; value: string };

type MdParent = {
  type: string;
  children: MdNode[];
  data?: { hProperties?: Record<string, string> };
};

type MdNode = MdText | MdParent | { type: string };

const alertMarker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n?/i;

export function isGithubAlertKind(value: string): value is GithubAlertKind {
  return alertKinds.some((kind) => kind === value);
}

export function githubAlertTitle(kind: GithubAlertKind): string {
  switch (kind) {
    case "note":
      return "Note";
    case "tip":
      return "Tip";
    case "important":
      return "Important";
    case "warning":
      return "Warning";
    case "caution":
      return "Caution";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function isParent(node: MdNode): node is MdParent {
  return "children" in node && Array.isArray(node.children);
}

function isText(node: MdNode): node is MdText {
  return node.type === "text" && "value" in node && typeof node.value === "string";
}

function applyAlert(blockquote: MdParent): void {
  const first = blockquote.children[0];
  if (first === undefined || !isParent(first) || first.type !== "paragraph") {
    return;
  }
  const text = first.children[0];
  if (text === undefined || !isText(text)) {
    return;
  }
  const match = alertMarker.exec(text.value);
  const rawKind = match?.[1];
  if (match === null || rawKind === undefined) {
    return;
  }
  const kind = rawKind.toLowerCase();
  if (!isGithubAlertKind(kind)) {
    return;
  }
  const rest = text.value.slice(match[0].length);
  if (rest.length === 0) {
    first.children = first.children.slice(1);
  } else {
    text.value = rest;
  }
  if (first.children.length === 0) {
    blockquote.children = blockquote.children.slice(1);
  }
  blockquote.data = {
    hProperties: {
      className: `agent-markdown-alert agent-markdown-alert--${kind}`,
      "data-alert": kind,
    },
  };
}

function visit(node: MdNode): void {
  if (!isParent(node)) {
    return;
  }
  if (node.type === "blockquote") {
    applyAlert(node);
  }
  for (const child of node.children) {
    visit(child);
  }
}

/** Turns a GitHub `> [!NOTE]` quote into a titled alert. Other quotes stay quotes. */
export function remarkGithubAlerts(): (tree: MdNode) => void {
  return (tree) => {
    visit(tree);
  };
}
