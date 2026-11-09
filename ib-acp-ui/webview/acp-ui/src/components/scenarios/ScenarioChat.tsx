import { type ReactElement, useMemo, useRef } from "react";
import type { ExtensionMessageAfterInit } from "../../chatReducer";
import { AcpUiApp } from "../../AcpUiApp";
import { chatFromFixture } from "./replayFixture";

const noop = () => undefined;

export function ScenarioChat({
  ndjson,
  seedText,
  extraMessages = [],
}: {
  ndjson: string;
  seedText?: string;
  extraMessages?: ExtensionMessageAfterInit[];
}): ReactElement {
  const { init, state } = useMemo(
    () => chatFromFixture(ndjson, seedText, extraMessages),
    [ndjson, seedText, extraMessages],
  );
  const extensionDispatchRef = useRef<((message: ExtensionMessageAfterInit) => void) | null>(null);
  return (
    <AcpUiApp
      init={init}
      initialChatState={state}
      postSend={noop}
      postCancel={noop}
      postRenameSession={noop}
      postResetSession={noop}
      postSetSessionModel={noop}
      postSetSessionConfigOption={noop}
      postSaveHistory={noop}
      postPermissionResponse={noop}
      postCursorAskQuestionResponse={noop}
      postCursorCreatePlanResponse={noop}
      extensionDispatchRef={extensionDispatchRef}
    />
  );
}
