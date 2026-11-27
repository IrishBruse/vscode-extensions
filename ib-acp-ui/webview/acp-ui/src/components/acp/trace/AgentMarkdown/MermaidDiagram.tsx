import { type ReactElement, useEffect, useState } from "react";
import { CopyCodeButton } from "./CopyCodeButton";

type MermaidTheme = "dark" | "default";

function mermaidTheme(): MermaidTheme {
  return document.body.classList.contains("vscode-light") ? "default" : "dark";
}

function svgIsSafe(svg: string): boolean {
  const lower = svg.toLowerCase();
  return !lower.includes("<script") && !lower.includes("javascript:") && !lower.includes("onerror=");
}

let nextMermaidId = 0;

async function renderMermaidSvg(source: string): Promise<string | undefined> {
  nextMermaidId += 1;
  const id = `acp-mermaid-${nextMermaidId}`;
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    htmlLabels: false,
    theme: mermaidTheme(),
    fontFamily: "var(--acp-ui-font-sans)",
  });
  try {
    const rendered = await mermaid.render(id, source);
    return svgIsSafe(rendered.svg) ? rendered.svg : undefined;
  } catch {
    return undefined;
  }
}

function MermaidSource({ source }: { source: string }): ReactElement {
  return (
    <div className="agent-markdown-code-block">
      <CopyCodeButton text={source} />
      <pre>
        <code className="language-mermaid">{source}</code>
      </pre>
    </div>
  );
}

/** Renders a fenced `mermaid` block. Invalid or unfinished source stays as code. */
export function MermaidDiagram({ source }: { source: string }): ReactElement {
  const [svg, setSvg] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void renderMermaidSvg(source).then((next) => {
      if (!cancelled && next !== undefined) {
        setSvg(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source]);
  if (svg === undefined) {
    return <MermaidSource source={source} />;
  }
  return (
    <div className="agent-markdown-mermaid">
      <CopyCodeButton text={source} />
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
