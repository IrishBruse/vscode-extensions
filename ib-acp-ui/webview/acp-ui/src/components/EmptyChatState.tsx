import type { ReactElement } from "react";
import type { AcpUiRecentSession } from "../../../../src/protocol/extensionHostMessages";
import { formatRelativeTime } from "../relativeTime";
import "./EmptyChatState.css";
import { VsDropdown } from "./VsDropdown";

export type EmptyChatStateProps = {
  providers: string[];
  currentProvider: string;
  recentSessions: AcpUiRecentSession[];
  onPickProvider: (agentName: string) => void;
  onOpenSession: (sessionId: string) => void;
};

/**
 * Empty new-chat page: provider select plus recent chats for that provider.
 */
export function EmptyChatState({
  providers,
  currentProvider,
  recentSessions,
  onPickProvider,
  onOpenSession,
}: EmptyChatStateProps): ReactElement {
  return (
    <div className="empty-chat">
      <div className="empty-chat-field">
        <label className="empty-chat-label" htmlFor="empty-chat-provider">
          Provider
        </label>
        <VsDropdown
          id="empty-chat-provider"
          className="empty-chat-select"
          ariaLabel="Provider"
          block
          value={currentProvider}
          options={providers.map((name) => ({ value: name, label: name }))}
          onChange={onPickProvider}
        />
      </div>
      <div className="empty-chat-field">
        <div className="empty-chat-label">Recent</div>
        {recentSessions.length === 0 ? (
          <p className="empty-chat-recent-empty">No recent chats</p>
        ) : (
          <ul className="empty-chat-recents" role="list">
            {recentSessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className="empty-chat-recent"
                  title={`${session.title} — ${new Date(session.updatedAt).toLocaleString()}`}
                  onClick={() => {
                    onOpenSession(session.id);
                  }}
                >
                  <span className="empty-chat-recent-title">{session.title}</span>
                  <span className="empty-chat-recent-time">
                    {formatRelativeTime(session.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
