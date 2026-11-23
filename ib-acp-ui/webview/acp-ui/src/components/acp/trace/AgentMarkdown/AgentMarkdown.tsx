import "./AgentMarkdown.css";
import {
  Children,
  isValidElement,
  memo,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { languageFromClassName, renderHighlightedCode } from "./codeHighlighting";

export type AgentMarkdownProps = {
  /** Full assistant message text; updates as streaming chunks arrive. */
  text: string;
  /** Called when a link is clicked. The argument is the link target. */
  onOpenLink?: (href: string) => void;
  /** Omit the code-copy button so this block can sit inside another control. */
  preview?: boolean;
};

type LinkCopyMenu = {
  x: number;
  y: number;
  href: string;
};

const CODE_TEXT_ATTR = "data-code-text";

function codeTextFromPreChild(children: ReactNode): string {
  const child = Children.toArray(children)[0];
  if (!isValidElement<Record<string, string | undefined>>(child)) {
    return "";
  }
  return child.props[CODE_TEXT_ATTR] ?? "";
}

function reactNodeToPlainText(node: ReactNode): string {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(reactNodeToPlainText).join("");
  }
  return "";
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText !== undefined) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function CopyCodeButton({ text }: { text: string }): ReactElement {
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

  return (
    <button
      type="button"
      className="agent-markdown-code-block-copy"
      onClick={onCopy}
      aria-label={copied ? "Copied" : "Copy code"}
      title={copied ? "Copied" : "Copy"}
    >
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

const markdownRemarkPlugins = [remarkGfm];

function MarkdownLink({
  href,
  children,
  node: _node,
  onOpenLink,
  onShowCopyMenu,
  ...rest
}: {
  href?: string;
  children?: ReactNode;
  node?: unknown;
  onOpenLink?: (href: string) => void;
  onShowCopyMenu?: (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;
}): ReactElement {
  const target = typeof href === "string" ? href.trim() : "";
  return (
    <a
      {...rest}
      href={target.length > 0 ? target : undefined}
      title={target.length > 0 ? target : undefined}
      onClick={(event) => {
        if (onOpenLink === undefined || target.length === 0) {
          return;
        }
        event.preventDefault();
        onOpenLink(target);
      }}
      onContextMenu={(event) => {
        if (target.length === 0) {
          return;
        }
        event.preventDefault();
        onShowCopyMenu?.(event, target);
      }}
    >
      {children}
    </a>
  );
}

function LinkCopyMenu({
  menu,
  onCopy,
  onClose,
}: {
  menu: LinkCopyMenu;
  onCopy: () => void;
  onClose: () => void;
}): ReactElement {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("pointerdown", onClose);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onClose);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="agent-markdown-link-menu"
      style={{ top: menu.y, left: menu.x }}
      role="menu"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <button type="button" role="menuitem" onClick={onCopy}>
        Copy link
      </button>
    </div>,
    document.body,
  );
}

const markdownComponents = {
  pre({ children, node: _node, ...rest }: { children?: ReactNode; node?: unknown }) {
    const codeText = codeTextFromPreChild(children);
    return (
      <div className="agent-markdown-code-block">
        <CopyCodeButton text={codeText} />
        <pre {...rest}>{children}</pre>
      </div>
    );
  },
  code(props: { className?: string; children?: ReactNode; node?: unknown }) {
    const { className, children, node: _node, ...rest } = props;
    const language = languageFromClassName(className);
    const codeText = reactNodeToPlainText(children).replace(/\n$/, "");
    if (!className) {
      return (
        <code {...rest} className={className}>
          {children}
        </code>
      );
    }
    return (
      <code {...rest} className={className} {...{ [CODE_TEXT_ATTR]: codeText }}>
        {renderHighlightedCode(language, codeText)}
      </code>
    );
  },
};

/**
 * Renders chat markdown with GFM (tables, strikethrough, task lists). Re-parses when `text`
 * changes so streaming chunks render incrementally. Unchanged text skips that parse.
 */
export const AgentMarkdown = memo(function AgentMarkdown({
  text,
  onOpenLink,
  preview = false,
}: AgentMarkdownProps): ReactElement {
  const [copyMenu, setCopyMenu] = useState<LinkCopyMenu | null>(null);
  const closeCopyMenu = useCallback(() => {
    setCopyMenu(null);
  }, []);
  const components = useMemo(
    () => ({
      ...markdownComponents,
      ...(preview
        ? {
            pre({ children, node: _node, ...rest }: { children?: ReactNode; node?: unknown }) {
              return <pre {...rest}>{children}</pre>;
            },
          }
        : {}),
      a(props: { href?: string; children?: ReactNode; node?: unknown }) {
        return (
          <MarkdownLink
            {...props}
            onOpenLink={onOpenLink}
            onShowCopyMenu={(event, href) => {
              const menuWidth = 120;
              const menuHeight = 36;
              setCopyMenu({
                href,
                x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth)),
                y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight)),
              });
            }}
          />
        );
      },
    }),
    [onOpenLink, preview],
  );
  if (text.length === 0) {
    return <div className="agent-markdown agent-markdown-empty" aria-hidden="true" />;
  }
  return (
    <div className="agent-markdown">
      <ReactMarkdown remarkPlugins={markdownRemarkPlugins} components={components}>
        {text}
      </ReactMarkdown>
      {copyMenu !== null ? (
        <LinkCopyMenu
          menu={copyMenu}
          onClose={closeCopyMenu}
          onCopy={() => {
            void copyTextToClipboard(copyMenu.href);
            setCopyMenu(null);
          }}
        />
      ) : null}
    </div>
  );
});
