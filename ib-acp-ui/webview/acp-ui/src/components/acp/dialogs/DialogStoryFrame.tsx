import type { ReactElement, ReactNode } from "react";
import "../../../AcpUiApp.css";

/**
 * Places a dialog above a composer stack, matching the chat shell.
 * The dialog is absolutely positioned with `bottom: 100%`, so the stack needs height below it.
 */
export function DialogStoryFrame({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div className="acp-ui-composer-stack">{children}</div>
    </div>
  );
}
