import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";

export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText !== undefined) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // The webview clipboard API can reject. Fall back to a selected textarea.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("Copy failed");
  }
}

export function CopyCodeButton({ text }: { text: string }): ReactElement {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== undefined) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const onCopy = useCallback(() => {
    if (text.length === 0) {
      return;
    }
    void copyTextToClipboard(text).then(() => {
      setCopied(true);
      if (resetTimerRef.current !== undefined) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  }, [text]);

  const className = copied
    ? "agent-markdown-code-block-copy agent-markdown-code-block-copy--copied"
    : "agent-markdown-code-block-copy";
  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onCopy();
      }}
      aria-label={copied ? "Copied" : "Copy code"}
    >
      {copied ? <span className="agent-markdown-code-block-copied">Copied</span> : null}
      {copied ? (
        <svg className="agent-markdown-code-block-copy-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
          />
        </svg>
      ) : (
        <svg className="agent-markdown-code-block-copy-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4 2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1H9v1H2V7a1 1 0 0 1 1-1h1V5Z"
          />
        </svg>
      )}
    </button>
  );
}
