import type { ReactElement } from "react";
import type { AcpUiMcpServerRow } from "../../../../../../src/protocol/extensionHostMessages";
import "./McpServersView.css";

export function McpServersView({
  servers,
  note,
}: {
  servers: readonly AcpUiMcpServerRow[];
  note: string | null;
}): ReactElement {
  return (
    <div className="mcp-servers">
      {note !== null && note.length > 0 ? <p className="mcp-servers-note">{note}</p> : null}
      {servers.length === 0 ? (
        <p className="mcp-servers-empty">
          No MCP servers for this chat. Add them in .cursor/mcp.json or in the ib-acp-ui.mcpServers
          setting.
        </p>
      ) : (
        <ul className="mcp-servers-list">
          {servers.map((server) => (
            <li key={`${server.source}:${server.name}`} className="mcp-servers-row">
              <div className="mcp-servers-head">
                <span className="mcp-servers-name">{server.name}</span>
                <span className="mcp-servers-transport">{server.transport}</span>
                <span
                  className={
                    server.forwarded ? "mcp-servers-status" : "mcp-servers-status mcp-servers-status--skipped"
                  }
                >
                  {server.forwarded ? "Forwarded" : (server.skipReason ?? "Skipped")}
                </span>
              </div>
              {server.detail.length > 0 ? (
                <div className="mcp-servers-detail">{server.detail}</div>
              ) : null}
              <div className="mcp-servers-source">{server.source}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
