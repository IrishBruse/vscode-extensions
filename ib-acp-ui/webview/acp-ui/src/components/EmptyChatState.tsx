import type { ReactElement } from "react";
import type { AcpUiRecentSession } from "../../../../src/protocol/extensionHostMessages";
import "./EmptyChatState.css";

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
        <select
          id="empty-chat-provider"
          className="empty-chat-select"
          aria-label="Provider"
          value={currentProvider}
          onChange={(event) => {
            onPickProvider(event.target.value);
          }}
        >
          {providers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
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
                  title={session.title}
                  onClick={() => {
                    onOpenSession(session.id);
                  }}
                >
                  {session.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
