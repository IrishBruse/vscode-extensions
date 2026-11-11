import { type ReactElement, useMemo } from "react";
import "./ShellCommandHighlight.css";
import { tokenizeShellCommand } from "./shellCommandTokens";

/**
 * Renders a shell command with fish-style token colors (VS Code terminal ANSI tokens).
 */
export function ShellCommandHighlight({
  command,
  className,
}: {
  command: string;
  className?: string;
}): ReactElement {
  const tokens = useMemo(() => tokenizeShellCommand(command), [command]);
  const rootClass =
    className === undefined || className.length === 0 ? "shell-hl" : `shell-hl ${className}`;
  return (
    <span className={rootClass}>
      {tokens.map((token, index) => (
        <span key={`${index}:${token.kind}`} className={`shell-hl--${token.kind}`}>
          {token.text}
        </span>
      ))}
    </span>
  );
}
