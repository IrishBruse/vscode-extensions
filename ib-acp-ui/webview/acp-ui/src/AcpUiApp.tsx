import "./AcpUiApp.css";
import "./scrollRegions.css";
import {
  Fragment,
  type DragEvent,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { agentTabIndicatorForTurn, type AgentTabIndicator } from "../../../src/protocol/agentTabTitle";
import type {
  AcpUiPromptImage,
  WorkspacePathOpenTarget,
} from "../../../src/protocol/extensionHostMessages";
import { anchoredScrollTop } from "./anchoredScroll";
import {
  activityTraceForTool,
  type ChatAction,
  chatReducer,
  createChatStateFromInit,
  type ChatState,
  type ExtensionMessageAfterInit,
  type InitPayload,
  type TraceItem,
} from "./chatReducer";
import { visibleTraceTail, type VisibleTraceRow } from "./visibleTraceTail";
import { AcpUiComposer } from "./AcpUiComposer";
import { installSessionModeIndicatorThemeColors } from "./sessionModeIndicatorTheme";
import {
  installAgentMarkdownThemeColors,
  updateAgentMarkdownThemeColors,
} from "./agentMarkdownTheme";
import { shouldOpenNewChatOnCtrlT } from "./components/acp/composer/ChatComposer/composerKeybindings";
import { CursorAskQuestionDialog } from "./components/acp/dialogs/CursorAskQuestionDialog/CursorAskQuestionDialog";
import { CursorCreatePlanDialog } from "./components/acp/dialogs/CursorCreatePlanDialog/CursorCreatePlanDialog";
import { EmptyChatState } from "./components/acp/session/EmptyChatState/EmptyChatState";
import { ImageViewer } from "./components/acp/dialogs/ImageViewer/ImageViewer";
import { PermissionDialog } from "./components/acp/dialogs/PermissionDialog/PermissionDialog";
import { SubagentFocus } from "./components/acp/trace/SubagentFocus/SubagentFocus";
import { TaskFocus } from "./components/acp/trace/SubagentFocus/TaskFocus";
import { subagentStatusLabel } from "./components/acp/trace/SubagentSessionBlock/subagentStatus";
import { TraceList } from "./components/acp/trace/TraceList/TraceList";
import { SessionHistoryLoader } from "./components/acp/trace/SessionHistoryLoader/SessionHistoryLoader";
import { collectPathsFromDataTransfer, dataTransferLooksLikePathDrop } from "./droppedFilePaths";

export type AcpUiAppProps = {
  init: InitPayload;
  initialChatState?: ChatState;
  postSend: (body: string, images?: AcpUiPromptImage[]) => void;
  postCancel: () => void;
  postRenameSession: (title: string) => void;
  postResetSession: () => void;
  postSetSessionModel: (modelId: string) => void;
  postSetSessionConfigOption: (configId: string, value: string | boolean) => void;
  postSaveHistory: (entries: string[]) => void;
  postSaveVisibleTrace?: (items: TraceItem[]) => void;
  postTabActivity?: (indicator: AgentTabIndicator | null, animate: boolean) => void;
  postOpenNewChat?: () => void;
  postSetSessionAgent?: (agentName: string) => void;
  postOpenSession?: (sessionId: string) => void;
  postOpenWorkspacePath?: (path: string, options?: { target?: WorkspacePathOpenTarget }) => void;
  postPermissionResponse: (
    payload:
      | { requestId: string; selectedOptionId: string }
      | { requestId: string; cancelled: true },
  ) => void;
  postCursorAskQuestionResponse: (payload: {
    requestId: string;
    outcome:
      | {
          outcome: "answered";
          answers: Array<{ questionId: string; selectedOptionIds: string[] }>;
        }
      | { outcome: "skipped"; reason?: string }
      | { outcome: "cancelled" };
  }) => void;
  postCursorCreatePlanResponse: (payload: {
    requestId: string;
    outcome:
      | { outcome: "accepted"; planUri?: string }
      | { outcome: "rejected"; reason?: string }
      | { outcome: "cancelled" };
  }) => void;
  postOpenPlan?: (payload: { requestId: string; name?: string; plan: string }) => void;
  extensionDispatchRef: RefObject<((message: ExtensionMessageAfterInit) => void) | null>;
  onExtensionDispatchReady?: () => void;
};

/**
 * ACP UI editor webview: header, transcript, composer, and protocol-driven transcript updates.
 */
export function AcpUiApp({
  init,
  initialChatState,
  postSend,
  postCancel,
  postRenameSession,
  postResetSession,
  postSetSessionModel,
  postSetSessionConfigOption,
  postSaveHistory,
  postSaveVisibleTrace,
  postTabActivity,
  postOpenNewChat,
  postSetSessionAgent,
  postOpenSession,
  postOpenWorkspacePath,
  postPermissionResponse,
  postCursorAskQuestionResponse,
  postCursorCreatePlanResponse,
  postOpenPlan,
  extensionDispatchRef,
  onExtensionDispatchReady,
}: AcpUiAppProps): ReactElement {
  const [state, dispatch] = useReducer(
    chatReducer,
    { init, initialChatState },
    ({ init: initPayload, initialChatState: replayed }) =>
      replayed ?? createChatStateFromInit(initPayload),
  );
  const [expandAllToolOutputs, setExpandAllToolOutputs] = useState(false);
  const [showThinkingBlocks, setShowThinkingBlocks] = useState(true);
  const [contentWidthRatio, setContentWidthRatio] = useState(init.contentWidthRatio ?? 1);
  const traceRef = useRef<HTMLElement | null>(null);
  const traceContentRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const scrollSnapshotRef = useRef({ scrollHeight: 0, scrollTop: 0 });
  const historyCommitSeenRef = useRef(state.historyCommit);
  const suppressStickToBottomRef = useRef(false);
  const lastSavedVisibleTraceRef = useRef("");
  const savedVisibleTraceCacheEpochRef = useRef(state.visibleTraceCacheEpoch);
  const earlierOverlayRef = useRef(false);
  const [earlierOverlay, setEarlierOverlay] = useState(false);
  const [fileDragActive, setFileDragActive] = useState(false);
  const [viewerImageSrc, setViewerImageSrc] = useState<string | null>(null);
  const [openAgent, setOpenAgent] = useState<
    { kind: "session"; sessionId: string } | { kind: "task"; toolCallId: string } | null
  >(null);
  const openAgentKey =
    openAgent === null
      ? ""
      : openAgent.kind === "task"
        ? `task:${openAgent.toolCallId}`
        : `session:${openAgent.sessionId}`;
  const openAgentSeenRef = useRef(openAgentKey);
  const appendDroppedPathsRef = useRef<(paths: string[]) => void>(() => {});

  const scrollTraceToBottomIfPinned = useCallback((): void => {
    if (suppressStickToBottomRef.current) {
      suppressStickToBottomRef.current = false;
      return;
    }
    const el = traceRef.current;
    if (el !== null && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const onTraceScroll = useCallback((): void => {
    const el = traceRef.current;
    if (el === null) {
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinned = distanceFromBottom <= 48;
    stickToBottomRef.current = pinned;
    scrollSnapshotRef.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
    const showEarlier = el.scrollTop <= 48 && !pinned;
    if (showEarlier !== earlierOverlayRef.current) {
      earlierOverlayRef.current = showEarlier;
      setEarlierOverlay(showEarlier);
    }
  }, []);

  extensionDispatchRef.current = (message: ExtensionMessageAfterInit) => {
    if (message.type === "vscodeThemeVariables") {
      updateAgentMarkdownThemeColors(message.variables);
      return;
    }
    if (message.type === "contentWidthRatio") {
      setContentWidthRatio(message.ratio);
      return;
    }
    dispatch(message as ChatAction);
  };

  useLayoutEffect(() => {
    onExtensionDispatchReady?.();
  }, [onExtensionDispatchReady]);

  useLayoutEffect(() => {
    const cleanup = installAgentMarkdownThemeColors(init.vscodeThemeVariables);
    return cleanup;
  }, [init]);

  useLayoutEffect(() => installSessionModeIndicatorThemeColors(), []);

  useLayoutEffect(() => {
    const el = traceRef.current;
    if (el === null) {
      return;
    }
    const swapped = state.historyCommit !== historyCommitSeenRef.current;
    historyCommitSeenRef.current = state.historyCommit;
    const opened = openAgentKey !== openAgentSeenRef.current;
    openAgentSeenRef.current = openAgentKey;
    if (opened) {
      stickToBottomRef.current = true;
      el.scrollTop = el.scrollHeight;
    } else if (swapped) {
      const previous = scrollSnapshotRef.current;
      if (stickToBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      } else {
        suppressStickToBottomRef.current = true;
        el.scrollTop = anchoredScrollTop({
          stickToBottom: false,
          previousScrollHeight: previous.scrollHeight,
          previousScrollTop: previous.scrollTop,
          nextScrollHeight: el.scrollHeight,
        });
      }
    } else {
      scrollTraceToBottomIfPinned();
    }
    scrollSnapshotRef.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
  }, [state.trace, state.subagentActivity, state.historyCommit, openAgentKey, scrollTraceToBottomIfPinned]);

  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root === null) {
      return;
    }
    const narrowMaxPx = 800;
    const syncNarrow = (): void => {
      root.classList.toggle("agent-root--narrow", root.clientWidth <= narrowMaxPx);
    };
    syncNarrow();
    const observer = new ResizeObserver(syncNarrow);
    observer.observe(root);
    return () => {
      observer.disconnect();
      root.classList.remove("agent-root--narrow");
    };
  }, []);

  useEffect(() => {
    if (
      postSaveVisibleTrace === undefined ||
      state.sessionHistoryLoading ||
      state.promptInFlight ||
      state.visibleTraceCacheEpoch <= savedVisibleTraceCacheEpochRef.current
    ) {
      return;
    }
    const epoch = state.visibleTraceCacheEpoch;
    const handle = window.setTimeout(() => {
      const el = traceRef.current;
      const rows: VisibleTraceRow[] = [];
      if (el !== null) {
        for (const node of el.querySelectorAll<HTMLElement>("[data-trace-index]")) {
          const start = Number(node.dataset.traceIndex);
          const end = Number(node.dataset.traceEnd ?? node.dataset.traceIndex);
          if (!Number.isInteger(start) || !Number.isInteger(end)) {
            continue;
          }
          rows.push({ start, end, height: node.offsetHeight });
        }
      }
      const items = visibleTraceTail(state.trace, rows, el?.clientHeight ?? 0);
      const serialized = JSON.stringify(items);
      if (serialized === lastSavedVisibleTraceRef.current) {
        savedVisibleTraceCacheEpochRef.current = epoch;
        return;
      }
      lastSavedVisibleTraceRef.current = serialized;
      savedVisibleTraceCacheEpochRef.current = epoch;
      postSaveVisibleTrace(items);
    }, 400);
    return () => {
      window.clearTimeout(handle);
    };
  }, [
    postSaveVisibleTrace,
    state.promptInFlight,
    state.sessionHistoryLoading,
    state.trace,
    state.visibleTraceCacheEpoch,
  ]);

  useEffect(() => {
    const content = traceContentRef.current;
    if (content === null) {
      return;
    }
    const observer = new ResizeObserver(() => {
      scrollTraceToBottomIfPinned();
    });
    observer.observe(content);
    const trace = traceRef.current;
    if (trace !== null) {
      observer.observe(trace);
    }
    return () => {
      observer.disconnect();
    };
  }, [scrollTraceToBottomIfPinned]);

  useEffect(() => {
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (shouldOpenNewChatOnCtrlT(event)) {
        if (postOpenNewChat !== undefined) {
          event.preventDefault();
          postOpenNewChat();
        }
        return;
      }
      if (event.key.toLowerCase() !== "o" || (!event.ctrlKey && !event.metaKey)) {
        return;
      }
      const target = event.target;
      if (
        target !== null &&
        target instanceof HTMLElement &&
        target.closest("textarea, input, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      setExpandAllToolOutputs((expanded) => !expanded);
    };
    document.addEventListener("keydown", onDocumentKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown, true);
    };
  }, [postOpenNewChat]);

  const dropFilesDisabled =
    state.promptInFlight ||
    state.permissionPrompt !== null ||
    state.askQuestionPrompt !== null ||
    state.createPlanPrompt !== null;

  useEffect(() => {
    if (!fileDragActive) {
      return;
    }
    const endDragUi = (): void => {
      setFileDragActive(false);
    };
    window.addEventListener("dragend", endDragUi);
    return () => {
      window.removeEventListener("dragend", endDragUi);
    };
  }, [fileDragActive]);

  const onCollapseExpandAll = useCallback((): void => {
    setExpandAllToolOutputs(false);
  }, []);

  const onToggleShowThinking = useCallback((): void => {
    setShowThinkingBlocks((showing) => !showing);
    dispatch({
      type: "commandFeedback",
      message: showThinkingBlocks ? "Thought blocks hidden." : "Thought blocks shown.",
    });
  }, [dispatch, showThinkingBlocks]);

  const tabIndicator = agentTabIndicatorForTurn({
    promptInFlight: state.promptInFlight,
    waitingForUser: state.askQuestionPrompt !== null,
    waitingForPlan: state.createPlanPrompt !== null,
    waitingForConfirmation: state.permissionPrompt !== null,
  });
  useEffect(() => {
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    postTabActivity?.(tabIndicator, animate);
  }, [postTabActivity, tabIndicator]);

  const permission = state.permissionPrompt;
  const askQuestion = state.askQuestionPrompt;
  const createPlan = state.createPlanPrompt;

  const onShellDragEnterCapture = (event: DragEvent<HTMLDivElement>): void => {
    if (dropFilesDisabled || !dataTransferLooksLikePathDrop(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    setFileDragActive(true);
  };

  const onShellDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    if (!dataTransferLooksLikePathDrop(event.dataTransfer)) {
      return;
    }
    const next = event.relatedTarget as Node | null;
    if (next !== null && event.currentTarget.contains(next)) {
      return;
    }
    setFileDragActive(false);
  };

  const onShellDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (dropFilesDisabled || !dataTransferLooksLikePathDrop(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onShellDrop = (event: DragEvent<HTMLDivElement>): void => {
    setFileDragActive(false);
    if (dropFilesDisabled || !dataTransferLooksLikePathDrop(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const root =
      init.workspaceLabel !== undefined && init.workspaceLabel.length > 0
        ? init.workspaceLabel
        : undefined;
    const paths = collectPathsFromDataTransfer(event.dataTransfer, root);
    if (paths.length === 0) {
      return;
    }
    appendDroppedPathsRef.current(paths);
  };

  const openSession =
    openAgent?.kind === "session"
      ? state.trace.find(
          (item) => item.type === "subagent" && item.sessionId === openAgent.sessionId,
        )
      : undefined;
  const openTask =
    openAgent?.kind === "task"
      ? state.trace.find((item) => item.type === "tool" && item.toolCallId === openAgent.toolCallId)
      : undefined;
  const taskActivityByToolId = new Map<string, readonly TraceItem[]>();
  for (const toolId of state.subagentSessionByToolId.keys()) {
    taskActivityByToolId.set(toolId, activityTraceForTool(state, toolId));
  }
  const openTaskActivity =
    openTask?.type === "tool" ? activityTraceForTool(state, openTask.toolCallId) : undefined;

  return (
    <Fragment>
      <div
        className={fileDragActive ? "acp-ui-shell acp-ui-shell--file-drag" : "acp-ui-shell"}
        style={
          {
            "--acp-ui-content-width-ratio": contentWidthRatio,
          } as React.CSSProperties
        }
        onDragEnterCapture={onShellDragEnterCapture}
        onDragLeave={onShellDragLeave}
        onDragOver={onShellDragOver}
        onDrop={onShellDrop}
      >
        <main
          ref={traceRef}
          className="agent-trace"
          role="log"
          aria-label="Conversation"
          onScroll={onTraceScroll}
        >
          {state.sessionHistoryLoading && state.trace.length > 0 && earlierOverlay ? (
            <div className="session-history-loader-anchor">
              <SessionHistoryLoader overlay />
            </div>
          ) : null}
          <div ref={traceContentRef} className="acp-ui-content-column">
            {state.sessionHistoryLoading && state.trace.length === 0 ? (
              <SessionHistoryLoader />
            ) : null}
            {state.trace.length === 0 && !state.sessionHistoryLoading ? (
              <EmptyChatState
                providers={state.providers}
                currentProvider={state.acpAgentSelection?.currentName ?? ""}
                recentSessions={state.recentSessions}
                onPickProvider={(agentName) => {
                  dispatch({ type: "pickSessionAgent", agentName });
                  postSetSessionAgent?.(agentName);
                }}
                onOpenSession={(sessionId) => {
                  postOpenSession?.(sessionId);
                }}
              />
            ) : null}
            {openSession?.type === "subagent" ? (
              <SubagentFocus
                title={openSession.title.trim().length > 0 ? openSession.title : "Subagent"}
                status={subagentStatusLabel(openSession.state, openSession.stopReason)}
                startedAtMs={openSession.state === "running" ? openSession.startedAtMs : undefined}
                description={openSession.description}
                items={state.subagentActivity.get(openSession.sessionId)?.trace ?? []}
                showThoughts={showThinkingBlocks}
                expandAllToolOutputs={expandAllToolOutputs}
                followBottom={stickToBottomRef.current}
                historyCommit={state.historyCommit}
                traceScrollRef={traceRef}
                onBack={() => {
                  setOpenAgent(null);
                }}
                onCollapseExpandAll={onCollapseExpandAll}
                onOpenWorkspacePath={postOpenWorkspacePath}
                onOpenImage={setViewerImageSrc}
                onOpenSubagent={(sessionId) => {
                  setOpenAgent({ kind: "session", sessionId });
                }}
                onOpenTask={(toolCallId) => {
                  setOpenAgent({ kind: "task", toolCallId });
                }}
                taskActivityByToolId={taskActivityByToolId}
              />
            ) : openTask?.type === "tool" ? (
              <TaskFocus
                item={openTask}
                activity={openTaskActivity}
                showThoughts={showThinkingBlocks}
                expandAllToolOutputs={expandAllToolOutputs}
                followBottom={stickToBottomRef.current}
                historyCommit={state.historyCommit}
                traceScrollRef={traceRef}
                onBack={() => {
                  setOpenAgent(null);
                }}
                onCollapseExpandAll={onCollapseExpandAll}
                onOpenWorkspacePath={postOpenWorkspacePath}
                onOpenImage={setViewerImageSrc}
                onOpenSubagent={(sessionId) => {
                  setOpenAgent({ kind: "session", sessionId });
                }}
                onOpenTask={(toolCallId) => {
                  setOpenAgent({ kind: "task", toolCallId });
                }}
                taskActivityByToolId={taskActivityByToolId}
              />
            ) : (
              <TraceList
                items={state.trace}
                showThoughts={showThinkingBlocks}
                expandAllToolOutputs={expandAllToolOutputs}
                followBottom={stickToBottomRef.current}
                historyCommit={state.historyCommit}
                traceScrollRef={traceRef}
                onOpenWorkspacePath={postOpenWorkspacePath}
                onOpenImage={setViewerImageSrc}
                onCollapseExpandAll={onCollapseExpandAll}
                onOpenSubagent={(sessionId) => {
                  setOpenAgent({ kind: "session", sessionId });
                }}
                onOpenTask={(toolCallId) => {
                  setOpenAgent({ kind: "task", toolCallId });
                }}
                taskActivityByToolId={taskActivityByToolId}
              />
            )}
          </div>
          <div className="agent-trace-follow-gap" aria-hidden="true" />
        </main>
        <div className="acp-ui-composer-stack">
          <div className="acp-ui-content-column">
            {permission !== null ? (
              <PermissionDialog
                toolTitle={permission.toolTitle}
                options={permission.options}
                onSelect={(optionId) => {
                  postPermissionResponse({
                    requestId: permission.requestId,
                    selectedOptionId: optionId,
                  });
                  dispatch({ type: "clearPermissionPrompt" });
                }}
                onDismiss={() => {
                  postPermissionResponse({
                    requestId: permission.requestId,
                    cancelled: true,
                  });
                  dispatch({ type: "clearPermissionPrompt" });
                }}
              />
            ) : null}
            {askQuestion !== null ? (
              <CursorAskQuestionDialog
                request={askQuestion}
                onSubmit={(answers) => {
                  postCursorAskQuestionResponse({
                    requestId: askQuestion.requestId,
                    outcome: { outcome: "answered", answers },
                  });
                  dispatch({ type: "clearAskQuestionPrompt" });
                }}
                onCancel={() => {
                  postCursorAskQuestionResponse({
                    requestId: askQuestion.requestId,
                    outcome: { outcome: "cancelled" },
                  });
                  dispatch({ type: "clearAskQuestionPrompt" });
                }}
              />
            ) : null}
            {createPlan !== null ? (
              <CursorCreatePlanDialog
                request={createPlan}
                onAccept={() => {
                  postCursorCreatePlanResponse({
                    requestId: createPlan.requestId,
                    outcome: { outcome: "accepted" },
                  });
                  dispatch({ type: "clearCreatePlanPrompt" });
                }}
                onReject={() => {
                  postCursorCreatePlanResponse({
                    requestId: createPlan.requestId,
                    outcome: { outcome: "rejected" },
                  });
                  dispatch({ type: "clearCreatePlanPrompt" });
                }}
                onCancel={() => {
                  postCursorCreatePlanResponse({
                    requestId: createPlan.requestId,
                    outcome: { outcome: "cancelled" },
                  });
                  dispatch({ type: "clearCreatePlanPrompt" });
                }}
                onOpenPlan={() => {
                  postOpenPlan?.({
                    requestId: createPlan.requestId,
                    plan: createPlan.plan,
                    ...(createPlan.name !== undefined && createPlan.name.trim().length > 0
                      ? { name: createPlan.name }
                      : {}),
                  });
                }}
              />
            ) : null}
            <AcpUiComposer
              initialHistory={init.history}
              workspaceFiles={init.workspaceFiles}
              workspaceLabel={init.workspaceLabel}
              slashCommands={state.slashCommands}
              modelSelection={state.modelSelection}
              sessionConfigOptions={state.sessionConfigOptions}
              sessionConfigLoading={state.sessionConfigLoading}
              composerPicksLocked={state.composerPicksLocked}
              hideComposerModelControls={state.hideComposerModelControls}
              promptInFlight={state.promptInFlight}
              inputBlocked={
                state.permissionPrompt !== null ||
                state.askQuestionPrompt !== null ||
                state.createPlanPrompt !== null
              }
              promptImageSupported={state.promptImageSupported}
              activity={
                state.errorText !== null && !state.agentConnected
                  ? "disconnected"
                  : state.errorText === null && !state.agentConnected && state.sessionConfigLoading
                    ? "connecting"
                    : state.thoughtStartedAtMs !== null
                      ? "thinking"
                      : null
              }
              statusDetail={state.errorText}
              thoughtStartedAtMs={state.thoughtStartedAtMs}
              sessionTitle={state.sessionTitle}
              trace={state.trace}
              tokenUsage={state.tokenUsage}
              dispatch={dispatch}
              postSend={postSend}
              postCancel={postCancel}
              postRenameSession={postRenameSession}
              postResetSession={postResetSession}
              postSetSessionModel={postSetSessionModel}
              postSetSessionConfigOption={postSetSessionConfigOption}
              postSaveHistory={postSaveHistory}
              onToggleShowThinking={onToggleShowThinking}
              stickToBottomRef={stickToBottomRef}
              onOpenImage={setViewerImageSrc}
              appendDroppedPathsRef={appendDroppedPathsRef}
            />
          </div>
        </div>
      </div>
      {viewerImageSrc !== null ? (
        <ImageViewer src={viewerImageSrc} onClose={() => setViewerImageSrc(null)} />
      ) : null}
    </Fragment>
  );
}

