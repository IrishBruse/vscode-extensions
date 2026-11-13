import {
  type ClipboardEvent,
  type Dispatch,
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  cycleSessionModePick,
  type AcpUiSessionConfigOption,
} from "../../../src/acp/session/sessionConfigOptions";
import type { AcpUiSessionModelSelection } from "../../../src/acp/session/sessionModels";
import type { AcpUiPromptImage, AcpUiSlashCommand } from "../../../src/protocol/extensionHostMessages";
import { type ChatAction, runningBashStartedAtMs, type TraceItem } from "./chatReducer";
import { type AcpUiTokenUsage } from "./tokenUsage";
import { ChatComposer } from "./components/acp/composer/ChatComposer/ChatComposer";
import { buildComposerAutocompleteState, wrapIndex } from "./components/acp/composer/ChatComposer/composerAutocomplete";
import {
  shouldCancelRunOnCtrlC,
  shouldCycleSessionModeOnShiftTab,
} from "./components/acp/composer/ChatComposer/composerKeybindings";
import {
  hasRunningTool,
  resolveFollowUpEnter,
  steerShouldStopAfterTool,
  type QueuedFollowUp,
} from "./components/acp/composer/ChatComposer/composerFollowUp";
import {
  historyCaretAtStart,
  historyCaretOnLastLine,
  recallAfterDraftEdit,
  recallNewerDraft,
  recallOlderDraft,
  undoToStashedDraft,
  type HistoryRecall,
} from "./components/acp/composer/ChatComposer/composerHistory";
import { appendFileMentionsToDraft } from "./droppedFilePaths";
import {
  clipboardHasImages,
  collectImagesFromClipboard,
  maxPasteImageCount,
} from "./pastedImages";

const emptyWorkspaceFiles: string[] = [];

export type AcpUiComposerProps = {
  initialHistory: string[] | undefined;
  workspaceFiles: string[] | undefined;
  workspaceLabel: string | undefined;
  slashCommands: AcpUiSlashCommand[];
  modelSelection: AcpUiSessionModelSelection | null;
  sessionConfigOptions: AcpUiSessionConfigOption[] | null;
  sessionConfigLoading: boolean;
  composerPicksLocked: boolean;
  hideComposerModelControls: boolean;
  promptInFlight: boolean;
  inputBlocked: boolean;
  promptImageSupported: boolean | null;
  activity: "connecting" | "thinking" | "disconnected" | null;
  statusDetail: string | null;
  thoughtStartedAtMs: number | null;
  sessionTitle: string;
  trace: TraceItem[];
  tokenUsage: AcpUiTokenUsage | null;
  dispatch: Dispatch<ChatAction>;
  postSend: (body: string, images?: AcpUiPromptImage[]) => void;
  postCancel: () => void;
  postRenameSession: (title: string) => void;
  postResetSession: () => void;
  postSetSessionModel: (modelId: string) => void;
  postSetSessionConfigOption: (configId: string, value: string | boolean) => void;
  postSaveHistory: (entries: string[]) => void;
  onToggleShowThinking: () => void;
  stickToBottomRef: { current: boolean };
  onOpenImage: (src: string) => void;
  appendDroppedPathsRef: { current: (paths: string[]) => void };
};

/**
 * Composer state lives here so keystrokes do not re-render the transcript.
 */
export function AcpUiComposer({
  initialHistory,
  workspaceFiles,
  workspaceLabel,
  slashCommands,
  modelSelection,
  sessionConfigOptions,
  sessionConfigLoading,
  composerPicksLocked,
  hideComposerModelControls,
  promptInFlight,
  inputBlocked,
  promptImageSupported,
  activity,
  statusDetail,
  thoughtStartedAtMs,
  sessionTitle,
  trace,
  tokenUsage,
  dispatch,
  postSend,
  postCancel,
  postRenameSession,
  postResetSession,
  postSetSessionModel,
  postSetSessionConfigOption,
  postSaveHistory,
  onToggleShowThinking,
  stickToBottomRef,
  onOpenImage,
  appendDroppedPathsRef,
}: AcpUiComposerProps): ReactElement {
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<string[]>(initialHistory ?? []);
  const [historyRecall, setHistoryRecall] = useState<HistoryRecall | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [composerSuggestionIndex, setComposerSuggestionIndex] = useState(0);
  const [composerAutocompleteDismissed, setComposerAutocompleteDismissed] = useState(false);
  const [pendingImages, setPendingImages] = useState<AcpUiPromptImage[]>([]);
  const [queuedFollowUps, setQueuedFollowUps] = useState<QueuedFollowUp[]>([]);
  const queueIdRef = useRef(1);
  const steerSawRunningToolRef = useRef(false);
  const awaitNextFlightRef = useRef(false);
  const flushingQueueIdRef = useRef<number | null>(null);
  const files = workspaceFiles ?? emptyWorkspaceFiles;
  const workspaceText =
    workspaceLabel !== undefined && workspaceLabel.length > 0
      ? workspaceLabel
      : "No workspace folder open";

  const builtInSlashCommands = useMemo((): AcpUiSlashCommand[] => {
    return [
      {
        name: "clear",
        description: "Clear the transcript and start a fresh agent session",
      },
      {
        name: "new",
        description: "Same as /clear — new session, empty transcript",
      },
      {
        name: "rename",
        description: "Rename the current chat (usage: /rename <new-name>)",
      },
      {
        name: "show-thinking",
        description: "Toggle visibility of thought blocks",
      },
    ];
  }, []);

  const mergedSlashCommands = useMemo(() => {
    const seen = new Set<string>();
    const out: AcpUiSlashCommand[] = [];
    for (const cmd of [...builtInSlashCommands, ...slashCommands]) {
      const key = cmd.name.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(cmd);
    }
    return out;
  }, [builtInSlashCommands, slashCommands]);

  const onDraftChange = useCallback((value: string): void => {
    setDraft(value);
    setHistoryRecall((recall) => recallAfterDraftEdit(recall, value, history));
    setComposerSuggestionIndex(0);
    setComposerAutocompleteDismissed(false);
  }, [history]);

  const releaseComposerDraft = useCallback((): void => {
    const recall = historyRecall;
    const current = draft;
    if (recall !== null && recall.stashedDraft !== current) {
      setDraft(recall.stashedDraft);
    } else {
      setDraft("");
    }
    setHistoryRecall(null);
    setPendingImages([]);
  }, [draft, historyRecall]);

  const onDismissAutocomplete = useCallback((): void => {
    setComposerSuggestionIndex(0);
    setComposerAutocompleteDismissed(true);
  }, []);

  const stopTurn = useCallback((): void => {
    dispatch({ type: "stopTurn" });
    postCancel();
  }, [dispatch, postCancel]);

  const onDismissFollowUp = useCallback((id: number): void => {
    if (queuedFollowUps[0]?.id === id) {
      steerSawRunningToolRef.current = false;
    }
    setQueuedFollowUps((items) => items.filter((item) => item.id !== id));
  }, [queuedFollowUps]);

  const onEditFollowUp = useCallback((id: number): void => {
    const item = queuedFollowUps.find((entry) => entry.id === id);
    if (item === undefined) {
      return;
    }
    const currentDraft = draft;
    const currentImages = pendingImages;
    const composerHasContent = currentDraft.trim().length > 0 || currentImages.length > 0;
    if (queuedFollowUps[0]?.id === id) {
      steerSawRunningToolRef.current = false;
    }
    setQueuedFollowUps((items) => {
      if (!composerHasContent) {
        return items.filter((entry) => entry.id !== id);
      }
      return items.map((entry) =>
        entry.id === id ? { ...entry, body: currentDraft, images: currentImages } : entry,
      );
    });
    setDraft(item.body);
    setPendingImages(item.images);
    setHistoryRecall((recall) => recallAfterDraftEdit(recall, item.body, history));
    setComposerAutocompleteDismissed(false);
    requestAnimationFrame(() => {
      composerTextareaRef.current?.focus();
    });
  }, [draft, history, pendingImages, queuedFollowUps]);

  const publishPrompt = useCallback((body: string, images: AcpUiPromptImage[]): void => {
    setHistory((prev) => {
      const next =
        prev.length > 0 && prev[prev.length - 1] === body ? prev : [...prev.slice(-49), body];
      postSaveHistory(next);
      return next;
    });
    stickToBottomRef.current = true;
    dispatch({
      type: "submit",
      body,
      ...(images.length > 0 ? { imageCount: images.length, images } : {}),
    });
    postSend(body, images.length > 0 ? images : undefined);
  }, [dispatch, postSaveHistory, postSend, stickToBottomRef]);

  const submit = (): void => {
    if (inputBlocked) {
      return;
    }
    const body = draft;
    const images = pendingImages;
    if (body.trim().length === 0 && images.length === 0) {
      return;
    }
    const asCommand = body.toLowerCase();
    if (asCommand === "/clear" || asCommand === "/new") {
      releaseComposerDraft();
      setQueuedFollowUps([]);
      steerSawRunningToolRef.current = false;
      stickToBottomRef.current = true;
      dispatch({ type: "sessionReset" });
      postResetSession();
      return;
    }
    if (asCommand === "/show-thinking") {
      releaseComposerDraft();
      onToggleShowThinking();
      return;
    }
    if (body.toLowerCase().startsWith("/rename")) {
      const match = body.match(/^\/rename\s+(\S+)$/i);
      if (match === null) {
        dispatch({
          type: "commandFeedback",
          message: "Usage: /rename <new-name>",
        });
        return;
      }
      const nextTitle = match[1]!;
      releaseComposerDraft();
      postRenameSession(nextTitle);
      return;
    }
    releaseComposerDraft();
    publishPrompt(body, images);
  };

  const handleComposerSend = (): void => {
    const trimmed = draft.trim().toLowerCase();
    const immediateCommand =
      trimmed === "/clear" ||
      trimmed === "/new" ||
      trimmed === "/show-thinking" ||
      trimmed.startsWith("/rename");
    if (immediateCommand) {
      submit();
      return;
    }
    const hasContent = draft.trim().length > 0 || pendingImages.length > 0;
    const action = resolveFollowUpEnter({
      promptInFlight,
      hasContent,
      queuedMode: queuedFollowUps[0]?.mode ?? null,
    });
    if (action === "send-now") {
      submit();
      return;
    }
    if (action === "enqueue") {
      const id = queueIdRef.current;
      queueIdRef.current += 1;
      setQueuedFollowUps((items) => [
        ...items,
        { id, body: draft, images: pendingImages, mode: "queue" },
      ]);
      releaseComposerDraft();
      return;
    }
    if (action === "steer") {
      setQueuedFollowUps((items) =>
        items.map((item, index) => (index === 0 ? { ...item, mode: "steer" } : item)),
      );
      return;
    }
    const head = queuedFollowUps[0];
    if (action === "interrupt" && head !== undefined) {
      steerSawRunningToolRef.current = false;
      setQueuedFollowUps((items) => items.slice(1));
      publishPrompt(head.body, head.images);
    }
  };

  useEffect(() => {
    if (promptInFlight) {
      awaitNextFlightRef.current = false;
    }
  }, [promptInFlight]);

  useEffect(() => {
    const head = queuedFollowUps[0];
    if (head === undefined) {
      steerSawRunningToolRef.current = false;
      flushingQueueIdRef.current = null;
      return;
    }
    if (flushingQueueIdRef.current === head.id) {
      return;
    }
    const toolRunning = hasRunningTool(
      trace.flatMap((item) => (item.type === "tool" ? [item.status] : [])),
    );
    if (head.mode === "steer" && toolRunning) {
      steerSawRunningToolRef.current = true;
    }
    const stopAfterTool =
      head.mode === "steer" &&
      steerShouldStopAfterTool({
        sawRunningTool: steerSawRunningToolRef.current,
        toolRunning,
        promptInFlight,
      });
    const turnFinished = !promptInFlight && !awaitNextFlightRef.current;
    if (!turnFinished && !stopAfterTool) {
      return;
    }
    if (turnFinished) {
      awaitNextFlightRef.current = true;
    }
    flushingQueueIdRef.current = head.id;
    steerSawRunningToolRef.current = false;
    setQueuedFollowUps((items) => items.filter((item) => item.id !== head.id));
    publishPrompt(head.body, head.images);
  }, [publishPrompt, queuedFollowUps, promptInFlight, trace]);

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    const target = event.currentTarget;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const mod = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
    const autocomplete = buildComposerAutocompleteState({
      draft,
      caret: start,
      slashCommands: mergedSlashCommands,
      workspaceFiles: files,
    });
    const autocompleteActive = autocomplete !== null && !composerAutocompleteDismissed;
    const hasSelection = start !== end;

    if (
      shouldCycleSessionModeOnShiftTab({
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
      }) &&
      !composerPicksLocked
    ) {
      const pick = cycleSessionModePick(
        sessionConfigOptions !== null ? { options: sessionConfigOptions } : null,
      );
      if (pick !== null) {
        event.preventDefault();
        dispatch({
          type: "pickSessionConfigOption",
          configId: pick.configId,
          value: pick.value,
        });
        postSetSessionConfigOption(pick.configId, pick.value);
        return;
      }
    }

    if (
      shouldCancelRunOnCtrlC({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        hasSelection,
        promptInFlight,
        thoughtRunning: thoughtStartedAtMs !== null,
        commandRunning: runningBashStartedAtMs(trace) !== undefined,
      })
    ) {
      event.preventDefault();
      stopTurn();
      return;
    }

    if (autocompleteActive && event.key === "Escape") {
      event.preventDefault();
      onDismissAutocomplete();
      return;
    }

    if (autocompleteActive && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setComposerSuggestionIndex((current) =>
        wrapIndex(current + delta, autocomplete.items.length),
      );
      return;
    }

    if (autocompleteActive && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const nextIndex = wrapIndex(composerSuggestionIndex, autocomplete.items.length);
      const selected = autocomplete.items[nextIndex];
      if (selected !== undefined) {
        const left = draft.slice(0, start);
        const lineStart = left.lastIndexOf("\n") + 1;
        const prefixToken = autocomplete.mode === "slash" ? "/" : "@";
        const tokenStart = left.lastIndexOf(prefixToken);
        if (tokenStart >= lineStart) {
          const right = draft.slice(start);
          const consumed = right.match(/^[^\s]*/)?.[0] ?? "";
          const nextDraft =
            draft.slice(0, tokenStart) + selected.insertText + right.slice(consumed.length);
          setDraft(nextDraft);
          setHistoryRecall((recall) => recallAfterDraftEdit(recall, nextDraft, history));
          setComposerSuggestionIndex(0);
          return;
        }
      }
    }

    const undoRecall =
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === "z";
    if (undoRecall) {
      const restored = undoToStashedDraft(draft, historyRecall);
      if (restored !== null) {
        event.preventDefault();
        setDraft(restored.draft);
        setHistoryRecall(restored.recall);
        setComposerSuggestionIndex(0);
        setComposerAutocompleteDismissed(false);
        return;
      }
    }

    if (event.key === "ArrowUp" && !mod) {
      const recalled = recallOlderDraft({
        draft,
        history,
        recall: historyRecall,
        caretAtStart: historyCaretAtStart(start, end),
      });
      if (recalled !== null) {
        event.preventDefault();
        setDraft(recalled.draft);
        setHistoryRecall(recalled.recall);
        setComposerSuggestionIndex(0);
        setComposerAutocompleteDismissed(false);
        return;
      }
    }

    if (event.key === "ArrowDown" && !mod) {
      const recalled = recallNewerDraft({
        draft,
        history,
        recall: historyRecall,
        caretOnLastLine: historyCaretOnLastLine(draft, start, end),
      });
      if (recalled !== null) {
        event.preventDefault();
        setDraft(recalled.draft);
        setHistoryRecall(recalled.recall);
        setComposerSuggestionIndex(0);
        setComposerAutocompleteDismissed(false);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleComposerSend();
    }
  };

  const onRemovePendingImage = useCallback((index: number): void => {
    setPendingImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index));
  }, []);

  const onComposerPaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const dt = event.clipboardData;
    if (dt === null || !clipboardHasImages(dt)) {
      return;
    }
    event.preventDefault();
    if (promptImageSupported === false) {
      dispatch({
        type: "commandFeedback",
        message: "This agent does not support pasted images.",
      });
      return;
    }
    void collectImagesFromClipboard(dt).then((images) => {
      if (images.length > 0) {
        setPendingImages((prev) =>
          [...prev, ...images].slice(Math.max(0, prev.length - maxPasteImageCount)),
        );
      }
    });
  };

  useEffect(() => {
    appendDroppedPathsRef.current = (paths: string[]): void => {
      const root =
        workspaceLabel !== undefined && workspaceLabel.length > 0 ? workspaceLabel : undefined;
      const next = appendFileMentionsToDraft(draft, paths, root);
      setDraft(next);
      setHistoryRecall((recall) => recallAfterDraftEdit(recall, next, history));
      requestAnimationFrame(() => {
        composerTextareaRef.current?.focus();
      });
    };
  }, [appendDroppedPathsRef, draft, history, workspaceLabel]);

  return (
    <ChatComposer
      workspacePathHint={workspaceText}
      sessionTitle={sessionTitle}
      modelSelection={modelSelection}
      sessionConfigOptions={sessionConfigOptions}
      sessionConfigLoading={sessionConfigLoading}
      modelPickerLocked={composerPicksLocked}
      hideComposerModelControls={hideComposerModelControls}
      promptInFlight={promptInFlight}
      inputBlocked={inputBlocked}
      slashCommands={mergedSlashCommands}
      workspaceFiles={files}
      suggestionIndex={composerSuggestionIndex}
      autocompleteDismissed={composerAutocompleteDismissed}
      draft={draft}
      onDraftChange={onDraftChange}
      onDismissAutocomplete={onDismissAutocomplete}
      onPickSessionModel={(modelId) => {
        dispatch({ type: "pickSessionModel", modelId });
        postSetSessionModel(modelId);
      }}
      onPickSessionConfigOption={(configId, value) => {
        dispatch({ type: "pickSessionConfigOption", configId, value });
        postSetSessionConfigOption(configId, value);
      }}
      onSubmit={handleComposerSend}
      followUps={queuedFollowUps}
      onDismissFollowUp={onDismissFollowUp}
      onEditFollowUp={onEditFollowUp}
      onCancel={stopTurn}
      onKeyDown={onComposerKeyDown}
      onPaste={onComposerPaste}
      activity={activity}
      statusDetail={statusDetail}
      thoughtStartedAtMs={thoughtStartedAtMs ?? undefined}
      commandStartedAtMs={runningBashStartedAtMs(trace)}
      pendingImages={pendingImages}
      onRemoveImage={onRemovePendingImage}
      onOpenImage={onOpenImage}
      tokenUsage={tokenUsage}
      composerInputRef={composerTextareaRef}
    />
  );
}
