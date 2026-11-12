import type { ReactElement } from "react";
import type { CreatePlanPromptState } from "../../../../chatReducer";
import { AgentMarkdown } from "../../trace/AgentMarkdown/AgentMarkdown";
import "../PermissionDialog/PermissionDialog.css";
import "./CursorCreatePlanDialog.css";

export function CursorCreatePlanDialog({
  request,
  onAccept,
  onReject,
  onCancel,
  onOpenPlan,
}: {
  request: CreatePlanPromptState;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  onOpenPlan: () => void;
}): ReactElement {
  const title = request.name?.trim() || "Approve plan";
  return (
    <div className="ib-plan-backdrop" role="presentation">
      <div className="ib-plan-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ib-plan-title">{title}</div>
        {request.overview ? <div className="ib-plan-overview">{request.overview}</div> : null}
        <div className="ib-plan-body">
          <AgentMarkdown text={request.plan} />
        </div>
        <div className="ib-plan-actions">
          <button
            type="button"
            className="ib-permission-button ib-permission-button--secondary"
            onClick={onOpenPlan}
          >
            Open plan
          </button>
          <div className="ib-plan-actions-end">
            <button type="button" className="ib-permission-button" onClick={onAccept}>
              Accept
            </button>
            <button type="button" className="ib-permission-button" onClick={onReject}>
              Reject
            </button>
            <button
              type="button"
              className="ib-permission-button ib-permission-button--secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
