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
  type FollowUpMode,
} from "./components/acp/composer/ChatComposer/composerFollowUp";
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
  const [historyBrowse, setHistoryBrowse] = useState<{
    pointer: number;
    restore: string;
  } | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [composerSuggestionIndex, setComposerSuggestionIndex] = useState(0);
  const [composerAutocompleteDismissed, setComposerAutocompleteDismissed] = useState(false);
  const [pendingImages, setPendingImages] = useState<AcpUiPromptImage[]>([]);
  const [queuedFollowUp, setQueuedFollowUp] = useState<{
    body: string;
    images: AcpUiPromptImage[];
    mode: FollowUpMode;
  } | null>(null);
  const steerSawRunningToolRef = useRef(false);
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
    setHistoryBrowse((browse) => (browse !== null ? null : browse));
    setComposerSuggestionIndex(0);
    setComposerAutocompleteDismissed(false);
  }, []);

  const onDismissAutocomplete = useCallback((): void => {
    setComposerSuggestionIndex(0);
    setComposerAutocompleteDismissed(true);
  }, []);

  const onDismissFollowUp = useCallback((): void => {
    setQueuedFollowUp(null);
    steerSawRunningToolRef.current = false;
  }, []);

  const onEditFollowUp = useCallback((): void => {
    if (queuedFollowUp === null) {
      return;
    }
    setDraft(queuedFollowUp.body);
    setPendingImages(queuedFollowUp.images);
    setQueuedFollowUp(null);
    steerSawRunningToolRef.current = false;
    setHistoryBrowse(null);
    setComposerAutocompleteDismissed(false);
    requestAnimationFrame(() => {
      composerTextareaRef.current?.focus();
    });
  }, [queuedFollowUp]);

  const deliverPrompt = useCallback((body: string, images: AcpUiPromptImage[]): void => {
    setDraft("");
    setHistoryBrowse(null);
    setQueuedFollowUp(null);
    steerSawRunningToolRef.current = false;
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
    setPendingImages([]);
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
      setDraft("");
      setHistoryBrowse(null);
      setQueuedFollowUp(null);
      stickToBottomRef.current = true;
      dispatch({ type: "sessionReset" });
      postResetSession();
      return;
    }
    if (asCommand === "/show-thinking") {
      setDraft("");
      setHistoryBrowse(null);
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
      setDraft("");
      setHistoryBrowse(null);
      postRenameSession(nextTitle);
      return;
    }
    deliverPrompt(body, images);
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
      queuedMode: queuedFollowUp?.mode ?? null,
    });
    if (action === "send-now") {
      submit();
      return;
    }
    if (action === "enqueue") {
      setQueuedFollowUp({ body: draft, images: pendingImages, mode: "queue" });
      setDraft("");
      setPendingImages([]);
      setHistoryBrowse(null);
      steerSawRunningToolRef.current = false;
      return;
    }
    if (action === "steer") {
      setQueuedFollowUp((current) =>
        current === null ? current : { ...current, mode: "steer" },
      );
      return;
    }
    if (action === "interrupt" && queuedFollowUp !== null) {
      deliverPrompt(queuedFollowUp.body, queuedFollowUp.images);
    }
  };

  useEffect(() => {
    if (queuedFollowUp === null) {
      steerSawRunningToolRef.current = false;
      return;
    }
    const toolRunning = hasRunningTool(
      trace.flatMap((item) => (item.type === "tool" ? [item.status] : [])),
    );
    if (queuedFollowUp.mode === "steer" && toolRunning) {
      steerSawRunningToolRef.current = true;
    }
    const turnFinished = !promptInFlight;
    const stopAfterTool =
      queuedFollowUp.mode === "steer" &&
      steerShouldStopAfterTool({
        sawRunningTool: steerSawRunningToolRef.current,
        toolRunning,
        promptInFlight,
      });
    if (!turnFinished && !stopAfterTool) {
      return;
    }
    deliverPrompt(queuedFollowUp.body, queuedFollowUp.images);
  }, [deliverPrompt, queuedFollowUp, promptInFlight, trace]);

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
      })
    ) {
      event.preventDefault();
      postCancel();
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
          setHistoryBrowse(null);
          setComposerSuggestionIndex(0);
          return;
        }
      }
    }

    if (event.key === "ArrowUp" && !mod) {
      if (historyBrowse !== null) {
        event.preventDefault();
        if (historyBrowse.pointer > 0) {
          const nextPointer = historyBrowse.pointer - 1;
          setHistoryBrowse({
            pointer: nextPointer,
            restore: historyBrowse.restore,
          });
          setDraft(history[nextPointer] ?? "");
        }
        return;
      }
      if (history.length > 0 && textareaAtFirstLineFirstColumn(start, end)) {
        event.preventDefault();
        const lastIdx = history.length - 1;
        setHistoryBrowse({ pointer: lastIdx, restore: draft });
        setDraft(history[lastIdx] ?? "");
        return;
      }
    }

    if (event.key === "ArrowDown" && !mod && historyBrowse !== null) {
      event.preventDefault();
      if (historyBrowse.pointer < history.length - 1) {
        const nextPointer = historyBrowse.pointer + 1;
        setHistoryBrowse({
          pointer: nextPointer,
          restore: historyBrowse.restore,
        });
        setDraft(history[nextPointer] ?? "");
      } else {
        setHistoryBrowse(null);
        setDraft(historyBrowse.restore);
      }
      return;
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
      setDraft((current) => appendFileMentionsToDraft(current, paths, root));
      setHistoryBrowse(null);
      requestAnimationFrame(() => {
        composerTextareaRef.current?.focus();
      });
    };
  }, [appendDroppedPathsRef, workspaceLabel]);

  return (
    <ChatComposer
      workspacePathHint={workspaceText}
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
      followUp={queuedFollowUp}
      onDismissFollowUp={onDismissFollowUp}
      onEditFollowUp={onEditFollowUp}
      onCancel={postCancel}
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

function textareaAtFirstLineFirstColumn(selectionStart: number, selectionEnd: number): boolean {
  if (selectionStart !== selectionEnd) {
    return false;
  }
  return selectionStart === 0;
}
