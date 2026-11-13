import type { ReactElement } from "react";
import type { ToolCallDiffRow } from "../../../../../../../src/protocol/extensionHostMessages";
import { backtickLooksLikePath, permissionTitleParts } from "./permissionTitle";
import "./PermissionDialog.css";

/**
 * Removes one outer pair of backticks from agent tool titles (markdown-style command snippets).
 */
function permissionToolSummaryForDisplay(raw: string): string {
  const t = raw.trim();
  if (t.length >= 2 && t.startsWith("`") && t.endsWith("`")) {
    return t.slice(1, -1).trim();
  }
  return raw;
}

/**
 * Modal strip above the composer for `session/request_permission` (ACP).
 */
function PermissionPathLink({
  path,
  onOpenPath,
}: {
  path: string;
  onOpenPath?: (path: string) => void;
}): ReactElement {
  return (
    <a
      className="ib-permission-path-link"
      href="#"
      title={path}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenPath?.(path);
      }}
    >
      {path}
    </a>
  );
}

export function PermissionDialog({
  toolTitle,
  detail,
  summary,
  diffRows,
  options,
  onSelect,
  onDismiss,
  onOpenPath,
}: {
  toolTitle: string;
  detail?: string;
  summary?: string;
  diffRows?: ToolCallDiffRow[];
  options: { optionId: string; name: string }[];
  onSelect: (optionId: string) => void;
  onDismiss: () => void;
  onOpenPath?: (path: string) => void;
}): ReactElement {
  const toolSummary = permissionToolSummaryForDisplay(toolTitle);
  const titleParts = permissionTitleParts(toolSummary);
  const detailText = detail?.trim() ?? "";
  const titleAlreadyShowsDetail = titleParts.some(
    (part) => part.kind === "path" && part.text === detailText,
  );
  const showDetail = detailText.length > 0 && detailText !== toolSummary && !titleAlreadyShowsDetail;
  const detailIsPath = backtickLooksLikePath(detailText);
  const summaryText = summary?.trim() ?? "";
  const previewRows = diffRows ?? [];
  return (
    <div className="ib-permission-backdrop" role="presentation">
      <div
        className="ib-permission-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ib-permission-title"
      >
        <div id="ib-permission-title" className="ib-permission-title">
          Permission required
        </div>
        <div className="ib-permission-tool" title={toolSummary}>
          {titleParts.map((part, index) =>
            part.kind === "path" ? (
              <PermissionPathLink key={index} path={part.text} onOpenPath={onOpenPath} />
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
        </div>
        {showDetail ? (
          <div className="ib-permission-detail" title={detailText}>
            {detailIsPath ? (
              <PermissionPathLink path={detailText} onOpenPath={onOpenPath} />
            ) : (
              detailText
            )}
          </div>
        ) : null}
        {summaryText.length > 0 ? <div className="ib-permission-summary">{summaryText}</div> : null}
        {previewRows.length > 0 ? (
          <div className="ib-permission-diff" role="group" aria-label="Change preview">
            {previewRows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className={
                  row.kind === "removed"
                    ? "ib-permission-diff-line ib-permission-diff-line--removed"
                    : row.kind === "added"
                      ? "ib-permission-diff-line ib-permission-diff-line--added"
                      : "ib-permission-diff-line ib-permission-diff-line--context"
                }
              >
                <span className="ib-permission-diff-text">{row.text.length > 0 ? row.text : " "}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="ib-permission-actions">
          {options.map((o) => (
            <button
              key={o.optionId}
              type="button"
              className="ib-permission-button"
              onClick={() => {
                onSelect(o.optionId);
              }}
            >
              {o.name}
            </button>
          ))}
          <button
            type="button"
            className="ib-permission-button ib-permission-button--secondary"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
