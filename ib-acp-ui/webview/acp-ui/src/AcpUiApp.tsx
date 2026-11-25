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
import { webviewLayoutIsMeasurable, webviewWidthIsMeasurable } from "./webviewLayout";
import {
  activityTraceForSession,
  activityTraceForTool,
  agentLinkTargetFromHref,
  bashDurationsFromTrace,
  subagentFocusItem,
  type ChatAction,
  chatReducer,
  createChatStateFromInit,
  type ChatState,
  type ExtensionMessageAfterInit,
  type InitPayload,
  thoughtDurationsFromTrace,
  traceCoversSubagentSession,
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
import { openTaskHeader } from "./components/acp/trace/SubagentBlock/SubagentBlock";
import { subagentStatusLabel } from "./components/acp/trace/SubagentBlock/subagentStatus";
import { SubagentFocus } from "./components/acp/trace/SubagentFocus/SubagentFocus";
import { ChatDebugView } from "./components/acp/debug/ChatDebugView";
import { McpServersView } from "./components/acp/mcp/McpServersView";
import { AcpRpcLogView } from "./components/acp/protocol/AcpRpcLogView";
import { TraceList } from "./components/acp/trace/TraceList/TraceList";
import { SessionHistoryLoader } from "./components/acp/trace/SessionHistoryLoader/SessionHistoryLoader";
import { collectPathsFromDataTransfer, dataTransferLooksLikePathDrop } from "./droppedFilePaths";
import {
  markdownExternalUrl,
  markdownFilePath,
} from "./components/acp/trace/AgentMarkdown/markdownLink";

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
  postSaveVisibleTrace?: (
    items: TraceItem[],
    thoughtDurations: number[],
    bashDurations: ChatState["bashDurations"],
  ) => void;
  postTabActivity?: (indicator: AgentTabIndicator | null, animate: boolean) => void;
  postOpenNewChat?: () => void;
  postSetSessionAgent?: (agentName: string) => void;
  postOpenSession?: (sessionId: string) => void;
  postDismissRecent?: (sessionId: string) => void;
  postOpenWorkspacePath?: (path: string, options?: { target?: WorkspacePathOpenTarget }) => void;
  postOpenExternalUrl?: (url: string) => void;
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
  postDismissRecent,
  postOpenWorkspacePath,
  postOpenExternalUrl,
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
  const [traceView, setTraceView] = useState<"chat" | "debug" | "acp" | "mcp">("chat");
  const [showThinkingBlocks, setShowThinkingBlocks] = useState(true);
  const [contentWidthRatio, setContentWidthRatio] = useState(init.contentWidthRatio ?? 1);
  const traceRef = useRef<HTMLElement | null>(null);
  const traceContentRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const scrollSnapshotRef = useRef({ scrollHeight: 0, scrollTop: 0 });
  const layoutHeldRef = useRef(false);
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
  const sentAutoPermissionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const pending = state.autoPermissionResponse;
    if (pending === null) {
      sentAutoPermissionIdRef.current = null;
      return;
    }
    if (sentAutoPermissionIdRef.current === pending.requestId) {
      return;
    }
    sentAutoPermissionIdRef.current = pending.requestId;
    postPermissionResponse({
      requestId: pending.requestId,
      selectedOptionId: pending.selectedOptionId,
    });
    dispatch({ type: "clearAutoPermission" });
  }, [postPermissionResponse, state.autoPermissionResponse]);

  const traceLayoutIsLive = useCallback((): boolean => {
    const el = traceRef.current;
    if (el === null) {
      return false;
    }
    return webviewLayoutIsMeasurable({
      visibilityState: document.visibilityState,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    });
  }, []);

  const scrollTraceToBottomIfPinned = useCallback((): void => {
    if (suppressStickToBottomRef.current) {
      suppressStickToBottomRef.current = false;
      return;
    }
    const el = traceRef.current;
    if (el !== null && stickToBottomRef.current && traceLayoutIsLive()) {
      el.scrollTop = el.scrollHeight;
    }
  }, [traceLayoutIsLive]);

  const restoreTraceScroll = useCallback((): void => {
    const el = traceRef.current;
    if (el === null) {
      return;
    }
    if (!traceLayoutIsLive()) {
      layoutHeldRef.current = true;
      return;
    }
    if (layoutHeldRef.current) {
      layoutHeldRef.current = false;
      el.scrollTop = stickToBottomRef.current
        ? el.scrollHeight
        : scrollSnapshotRef.current.scrollTop;
      return;
    }
    scrollTraceToBottomIfPinned();
  }, [scrollTraceToBottomIfPinned, traceLayoutIsLive]);

  const onTraceScroll = useCallback((): void => {
    const el = traceRef.current;
    if (el === null || !traceLayoutIsLive()) {
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
  }, [traceLayoutIsLive]);

  extensionDispatchRef.current = (message: ExtensionMessageAfterInit) => {
    if (message.type === "vscodeThemeVariables") {
      updateAgentMarkdownThemeColors(message.variables);
      return;
    }
    if (message.type === "contentWidthRatio") {
      setContentWidthRatio(message.ratio);
      return;
    }
    if (message.type === "focusTraceView") {
      setTraceView(message.view);
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
    if (el === null || !traceLayoutIsLive()) {
      layoutHeldRef.current = true;
      historyCommitSeenRef.current = state.historyCommit;
      openAgentSeenRef.current = openAgentKey;
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
  }, [state.trace, state.subagentActivity, state.historyCommit, openAgentKey, scrollTraceToBottomIfPinned, traceLayoutIsLive]);

  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root === null) {
      return;
    }
    const narrowMaxPx = 800;
    const syncNarrow = (): void => {
      if (
        !webviewWidthIsMeasurable({
          visibilityState: document.visibilityState,
          clientWidth: root.clientWidth,
        })
      ) {
        return;
      }
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
      const items = visibleTraceTail(state.trace, rows, el?.clientHeight ?? 0).filter(
        (item) =>
          item.type !== "subagent" ||
          !traceCoversSubagentSession(
            state.trace,
            state.subagentSessionByToolId,
            item.sessionId,
          ),
      );
      const thoughtDurations = thoughtDurationsFromTrace(state.trace);
      const bashDurations = bashDurationsFromTrace(state.trace);
      const serialized = JSON.stringify({ items, thoughtDurations, bashDurations });
      if (serialized === lastSavedVisibleTraceRef.current) {
        savedVisibleTraceCacheEpochRef.current = epoch;
        return;
      }
      lastSavedVisibleTraceRef.current = serialized;
      savedVisibleTraceCacheEpochRef.current = epoch;
      postSaveVisibleTrace(items, thoughtDurations, bashDurations);
    }, 400);
    return () => {
      window.clearTimeout(handle);
    };
  }, [
    postSaveVisibleTrace,
    state.promptInFlight,
    state.sessionHistoryLoading,
    state.subagentSessionByToolId,
    state.trace,
    state.visibleTraceCacheEpoch,
  ]);

  useEffect(() => {
    const content = traceContentRef.current;
    if (content === null) {
      return;
    }
    const observer = new ResizeObserver(() => {
      restoreTraceScroll();
    });
    observer.observe(content);
    const trace = traceRef.current;
    if (trace !== null) {
      observer.observe(trace);
    }
    return () => {
      observer.disconnect();
    };
  }, [restoreTraceScroll]);

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

  const onOpenMarkdownLink = (href: string): void => {
    const agent = agentLinkTargetFromHref(href, state);
    if (agent !== undefined) {
      setOpenAgent(agent);
      return;
    }
    const filePath = markdownFilePath(href);
    if (filePath !== undefined) {
      postOpenWorkspacePath?.(filePath);
      return;
    }
    const url = markdownExternalUrl(href);
    if (url !== undefined) {
      postOpenExternalUrl?.(url);
    }
  };
  const openSession =
    openAgent?.kind === "session" ? subagentFocusItem(state, openAgent.sessionId) : undefined;
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
        <header className="acp-ui-top-chrome">
          <div className="acp-ui-top-chrome-leading">
            {openAgent !== null ? (
              <button
                type="button"
                className="acp-ui-focus-back"
                onClick={() => {
                  setOpenAgent(null);
                }}
              >
                Back
              </button>
            ) : null}
          </div>
          <div className="acp-ui-view-switch" role="tablist" aria-label="Chat view">
            <button
              type="button"
              role="tab"
              aria-selected={traceView === "chat"}
              onClick={() => {
                setTraceView("chat");
              }}
            >
              Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={traceView === "debug"}
              onClick={() => {
                setTraceView("debug");
              }}
            >
              Debug
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={traceView === "acp"}
              onClick={() => {
                setTraceView("acp");
              }}
            >
              ACP
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={traceView === "mcp"}
              onClick={() => {
                setTraceView("mcp");
              }}
            >
              MCP
            </button>
          </div>
        </header>
        <main
          ref={traceRef}
          className={
            traceView === "chat"
              ? "agent-trace"
              : traceView === "debug"
                ? "agent-trace agent-trace--debug"
                : "agent-trace agent-trace--debug agent-trace--acp"
          }
          role="log"
          aria-label={
            traceView === "debug"
              ? "Debug view"
              : traceView === "acp"
                ? "ACP protocol"
                : traceView === "mcp"
                  ? "MCP servers"
                  : "Conversation"
          }
          onScroll={onTraceScroll}
        >
          {traceView === "debug" ? (
            <ChatDebugView
              trace={state.trace}
              title={state.sessionTitle}
              agentName={state.acpAgentSelection?.currentName}
              childTraces={state.subagentActivity}
              activityByToolId={taskActivityByToolId}
            />
          ) : traceView === "acp" ? (
            <AcpRpcLogView
              entries={state.acpRpcLines}
              logPath={state.acpRpcLogPath}
              homeDir={init.homeDir}
            />
          ) : traceView === "mcp" ? (
            <McpServersView servers={state.mcpServers} note={state.mcpServerNote} />
          ) : (
          <>
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
                onRemoveRecent={(sessionId) => {
                  dispatch({ type: "dismissRecentSession", sessionId });
                  postDismissRecent?.(sessionId);
                }}
              />
            ) : null}
            {openSession?.type === "subagent" ? (
              <SubagentFocus
                title={openSession.title.trim().length > 0 ? openSession.title : "Subagent"}
                status={subagentStatusLabel(openSession.state, openSession.stopReason)}
                startedAtMs={openSession.state === "running" ? openSession.startedAtMs : undefined}
                description={openSession.description}
                items={activityTraceForSession(state, openSession.sessionId)}
                showThoughts={showThinkingBlocks}
                expandAllToolOutputs={expandAllToolOutputs}
                followBottom={stickToBottomRef.current}
                historyCommit={state.historyCommit}
                traceScrollRef={traceRef}
                onCollapseExpandAll={onCollapseExpandAll}
                onOpenWorkspacePath={postOpenWorkspacePath}
                onOpenImage={setViewerImageSrc}
                onOpenSubagent={(sessionId) => {
                  setOpenAgent({ kind: "session", sessionId });
                }}
                onOpenTask={(toolCallId) => {
                  setOpenAgent({ kind: "task", toolCallId });
                }}
                onOpenMarkdownLink={onOpenMarkdownLink}
                taskActivityByToolId={taskActivityByToolId}
                subagentSessionByToolId={state.subagentSessionByToolId}
              />
            ) : openTask?.type === "tool" ? (
              <SubagentFocus
                {...openTaskHeader(openTask)}
                items={openTaskActivity ?? []}
                showThoughts={showThinkingBlocks}
                expandAllToolOutputs={expandAllToolOutputs}
                followBottom={stickToBottomRef.current}
                historyCommit={state.historyCommit}
                traceScrollRef={traceRef}
                onCollapseExpandAll={onCollapseExpandAll}
                onOpenWorkspacePath={postOpenWorkspacePath}
                onOpenImage={setViewerImageSrc}
                onOpenSubagent={(sessionId) => {
                  setOpenAgent({ kind: "session", sessionId });
                }}
                onOpenTask={(toolCallId) => {
                  setOpenAgent({ kind: "task", toolCallId });
                }}
                onOpenMarkdownLink={onOpenMarkdownLink}
                taskActivityByToolId={taskActivityByToolId}
                subagentSessionByToolId={state.subagentSessionByToolId}
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
                onOpenMarkdownLink={onOpenMarkdownLink}
                taskActivityByToolId={taskActivityByToolId}
                subagentSessionByToolId={state.subagentSessionByToolId}
              />
            )}
          </div>
          <div className="agent-trace-follow-gap" aria-hidden="true" />
          </>
          )}
        </main>
        {traceView === "chat" ||
        permission !== null ||
        askQuestion !== null ||
        createPlan !== null ? (
        <div className="acp-ui-composer-stack">
          <div className="acp-ui-content-column">
            {permission !== null ? (
              <PermissionDialog
                toolTitle={permission.toolTitle}
                detail={permission.detail}
                summary={permission.summary}
                diffRows={permission.diffRows}
                options={permission.options}
                onOpenPath={postOpenWorkspacePath}
                onSelect={(optionId) => {
                  const option = permission.options.find((entry) => entry.optionId === optionId);
                  postPermissionResponse({
                    requestId: permission.requestId,
                    selectedOptionId: optionId,
                  });
                  dispatch({
                    type: "answerPermission",
                    optionId,
                    optionName: option?.name ?? "",
                    ...(permission.toolKind !== undefined ? { toolKind: permission.toolKind } : {}),
                  });
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
                onSkip={() => {
                  postCursorAskQuestionResponse({
                    requestId: askQuestion.requestId,
                    outcome: { outcome: "skipped" },
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
            {traceView === "chat" ? (
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
            ) : null}
          </div>
        </div>
        ) : null}
      </div>
      {viewerImageSrc !== null ? (
        <ImageViewer src={viewerImageSrc} onClose={() => setViewerImageSrc(null)} />
      ) : null}
    </Fragment>
  );
}

