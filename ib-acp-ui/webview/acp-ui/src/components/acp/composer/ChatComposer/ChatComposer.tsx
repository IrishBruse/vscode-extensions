import {
  Fragment,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
} from "react";
import "./ChatComposer.css";
import {
  buildModelPickerState,
  formatModelDisplayName,
  parseModelIdBracketParams,
  pickVariantForGroup,
} from "../../../../../../../src/acp/session/modelVariantPicker";
import type { AcpUiSessionModelSelection } from "../../../../../../../src/acp/session/sessionModels";
import { formatTokenUsage, type AcpUiTokenUsage } from "../../../../tokenUsage";
import {
  groupedModelChoices,
  modeConfigOption,
  modelConfigOption,
  modelParameterOptions,
  pickModelOptionForFamily,
  resolveDerivedModelParamPick,
  resolveModelSelectOption,
  isDerivedConfigId,
  usesAgentOrderedConfigLayout,
  configOptionsSummaryLabel,
} from "../../../../../../../src/acp/session/sessionConfigOptions";
import type { AcpUiSessionConfigOption } from "../../../../../../../src/acp/session/sessionConfigOptions";
import {
  isSessionModeConfigOption,
  resolveComposerPlaceholder,
} from "../../../../../../../src/acp/session/sessionModeIndicator";
import type { AcpUiPromptImage, AcpUiSlashCommand } from "../../../../../../../src/protocol/extensionHostMessages";
import { buildComposerAutocompleteState, wrapIndex } from "./composerAutocomplete";
import { ConfigOptionControls, ComposerConfigLoading } from "../ConfigOptionControls/ConfigOptionControls";
import { SessionModeIndicator } from "../SessionModeIndicator/SessionModeIndicator";
import { Dropdown } from "../../../vscode/Dropdown/Dropdown";
import { promptImageSrc } from "../../../../pastedImages";
import type { FollowUpMode } from "./composerFollowUp";

export type ChatComposerProps = {
  activityLabel: string | null;
  /** Shown in the activity slot when nothing is in flight (e.g. workspace cwd). */
  workspacePathHint: string;
  modelSelection: AcpUiSessionModelSelection | null;
  sessionConfigOptions: AcpUiSessionConfigOption[] | null;
  sessionConfigLoading: boolean;
  /** When true, model is shown as a label (playground: after the first message). */
  modelPickerLocked: boolean;
  /** Hides model/config dropdowns in the composer footer. */
  hideComposerModelControls: boolean;
  promptInFlight: boolean;
  /** When set, blocks the textarea (e.g. pending permission dialog). */
  inputBlocked: boolean;
  slashCommands: AcpUiSlashCommand[];
  workspaceFiles: string[];
  suggestionIndex: number;
  /** When true, hide autocomplete until the draft changes. */
  autocompleteDismissed: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  /** Hide autocomplete until the draft changes (Escape / outside click). */
  onDismissAutocomplete: () => void;
  onPickSessionModel: (modelId: string) => void;
  onPickSessionConfigOption: (configId: string, value: string | boolean) => void;
  onSubmit: () => void;
  /** Draft held until the running turn can take it. */
  followUp?: {
    body: string;
    images: AcpUiPromptImage[];
    mode: FollowUpMode;
  } | null;
  onDismissFollowUp?: () => void;
  onEditFollowUp?: () => void;
  onCancel: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Paste handler on the textarea; captures image clips as attachments. */
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** Base64 image attachments pending on the next send. */
  pendingImages: AcpUiPromptImage[];
  onRemoveImage: (index: number) => void;
  /** Opens the fullscreen image viewer for one pending image (data URL). */
  onOpenImage: (src: string) => void;
  /** Context window usage chip; hidden until the agent reports usage. */
  tokenUsage: AcpUiTokenUsage | null;
  /** Focus target after external inserts (e.g. file drop). */
  composerInputRef?: RefObject<HTMLTextAreaElement | null>;
};

function sendFollowUpLabel(
  promptInFlight: boolean,
  hasContent: boolean,
  mode: FollowUpMode | null,
): string {
  if (!promptInFlight) {
    return "Send";
  }
  if (mode === "steer" && !hasContent) {
    return "Interrupt";
  }
  if (mode === "queue" && !hasContent) {
    return "Steer";
  }
  return "Queue";
}

/**
 * Activity hint, optional model picker, message input, and send/cancel actions.
 */
export function ChatComposer({
  activityLabel,
  workspacePathHint,
  modelSelection,
  sessionConfigOptions,
  sessionConfigLoading,
  modelPickerLocked,
  hideComposerModelControls,
  promptInFlight,
  inputBlocked,
  slashCommands,
  workspaceFiles,
  suggestionIndex,
  autocompleteDismissed,
  draft,
  onDraftChange,
  onDismissAutocomplete,
  onPickSessionModel,
  onPickSessionConfigOption,
  onSubmit,
  followUp = null,
  onDismissFollowUp,
  onEditFollowUp,
  onCancel,
  onKeyDown,
  onPaste,
  pendingImages,
  onRemoveImage,
  onOpenImage,
  tokenUsage,
  composerInputRef,
}: ChatComposerProps): ReactElement {
  const textareaDisabled = inputBlocked;
  const autocomplete = useMemo(() => {
    const caret = draft.length;
    return buildComposerAutocompleteState({
      draft,
      caret,
      slashCommands,
      workspaceFiles,
    });
  }, [draft, slashCommands, workspaceFiles]);
  const autocompleteOpen = autocomplete !== null && !autocompleteDismissed;
  const activeIndex =
    autocomplete !== null ? wrapIndex(suggestionIndex, autocomplete.items.length) : 0;
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  const slashMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, autocomplete?.items.length]);
  useEffect(() => {
    if (!autocompleteOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent): void => {
      const menu = slashMenuRef.current;
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (menu !== null && menu.contains(target)) {
        return;
      }
      if (target instanceof Element && target.closest(".composer-input") !== null) {
        return;
      }
      onDismissAutocomplete();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [autocompleteOpen, onDismissAutocomplete]);
  const configState = useMemo(
    () => (sessionConfigOptions !== null ? { options: sessionConfigOptions } : null),
    [sessionConfigOptions],
  );
  const modeOption = useMemo(() => modeConfigOption(configState), [configState]);
  const composerPlaceholder = useMemo(
    () => resolveComposerPlaceholder(modeOption?.currentValue ?? ""),
    [modeOption],
  );
  const toolbarConfigOptions = useMemo(
    () =>
      sessionConfigOptions !== null
        ? sessionConfigOptions.filter((option) => !isSessionModeConfigOption(option))
        : null,
    [sessionConfigOptions],
  );
  const agentOrderedLayout = usesAgentOrderedConfigLayout(configState);
  const configModelOption = useMemo(() => modelConfigOption(configState), [configState]);
  const configModelGroups = useMemo(
    () => (configModelOption !== undefined ? groupedModelChoices(configModelOption) : []),
    [configModelOption],
  );
  const configParamOptions = useMemo(
    () => modelParameterOptions(configState, modelSelection),
    [configState, modelSelection],
  );
  const resolvedModelOption = useMemo(
    () => resolveModelSelectOption(configState, modelSelection),
    [configState, modelSelection],
  );
  const useLegacyModelPath = configModelOption === undefined;
  const useConfigModelPicker = configModelOption !== undefined && !agentOrderedLayout;
  const modelSel = modelSelection;
  const showConfigLoading = !modelPickerLocked && sessionConfigLoading;
  const modelReady =
    agentOrderedLayout ||
    useConfigModelPicker ||
    (modelSel !== null && modelSel.availableModels.length > 0);
  const modelSelectDisabled = modelPickerLocked || textareaDisabled || !modelReady;
  const modelPickerState = useMemo(() => {
    if (useConfigModelPicker || !modelReady || modelSel === null) {
      return null;
    }
    return buildModelPickerState(modelSel.availableModels, modelSel.currentModelId);
  }, [useConfigModelPicker, modelReady, modelSel]);
  const configCurrentGroupName = useMemo(() => {
    if (configModelOption === undefined) {
      return "";
    }
    const currentChoice = configModelOption.options.find(
      (choice) => choice.value === configModelOption.currentValue,
    );
    if (currentChoice !== undefined) {
      return currentChoice.name;
    }
    return parseModelIdBracketParams(configModelOption.currentValue).base;
  }, [configModelOption]);
  const modelLabel = agentOrderedLayout
    ? configOptionsSummaryLabel(sessionConfigOptions ?? [])
    : useConfigModelPicker
      ? formatModelDisplayName(configCurrentGroupName, configModelOption?.currentValue ?? "")
      : (modelPickerState?.currentGroupLabel ?? "");

  const handleModelParamPick = (configId: string, value: string | boolean): void => {
    if (resolvedModelOption !== undefined && isDerivedConfigId(configId)) {
      const nextModelId = resolveDerivedModelParamPick(resolvedModelOption, configId, value);
      if (nextModelId === null) {
        return;
      }
      if (useLegacyModelPath) {
        onPickSessionModel(nextModelId);
        return;
      }
      onPickSessionConfigOption(resolvedModelOption.configId, nextModelId);
      return;
    }
    onPickSessionConfigOption(configId, value);
  };

  const inflight = activityLabel !== null && activityLabel.length > 0;
  const activityDisplay = inflight ? activityLabel : workspacePathHint;
  const followUpSummary =
    followUp === null
      ? ""
      : followUp.body.trim().length > 0
        ? followUp.body.replace(/\s+/g, " ").trim()
        : followUp.images.length === 1
          ? "1 image"
          : `${followUp.images.length} images`;
  return (
    <div className="composer-stack">
      {followUp !== null ? (
        <div className="composer-follow-up-bar" role="status">
          <span className="composer-follow-up-label">
            {followUp.mode === "queue" ? "Queued" : "Steering"}
          </span>
          <span className="composer-follow-up-text" title={followUpSummary}>
            {followUpSummary}
          </span>
          <div className="composer-follow-up-actions">
            <button
              type="button"
              className="composer-follow-up-action"
              aria-label="Edit queued message"
              onClick={() => onEditFollowUp?.()}
            >
              <svg className="composer-follow-up-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M11.5 1.5a1.2 1.2 0 0 1 1.7 1.7l-9 9L2 13.5l1.3-2.2 9-9zM12.3 2.3 4 10.6l-.7 1.2 1.2-.7 8.3-8.3-1.5-1.5z"
                />
              </svg>
            </button>
            <button
              type="button"
              className="composer-follow-up-action"
              aria-label="Remove queued message"
              onClick={() => onDismissFollowUp?.()}
            >
              <svg className="composer-follow-up-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M3.7 3.7a.9.9 0 0 1 1.3 0L8 6.7l3-3a.9.9 0 1 1 1.3 1.3L9.3 8l3 3a.9.9 0 1 1-1.3 1.3L8 9.3l-3 3a.9.9 0 1 1-1.3-1.3L6.7 8l-3-3a.9.9 0 0 1 0-1.3z"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
      {pendingImages.length > 0 ? (
        <div className="composer-image-row" role="list" aria-label="Attached images">
          {pendingImages.map((image, index) => (
            <span
              key={`${index}:${image.mimeType}:${image.data.length}`}
              className="composer-image-chip"
              role="listitem"
            >
              <img
                className="composer-image-thumb"
                src={promptImageSrc(image)}
                alt={`Pasted image ${index + 1}`}
                onClick={() => onOpenImage(promptImageSrc(image))}
              />
              <button
                type="button"
                className="composer-image-remove"
                aria-label={`Remove pasted image ${index + 1}`}
                onClick={() => onRemoveImage(index)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <footer className="composer-frame">
      {autocomplete !== null && autocompleteOpen ? (
        <div
          ref={slashMenuRef}
          className="composer-slash-menu"
          role="listbox"
          aria-label={autocomplete.mode === "slash" ? "Slash commands" : "Workspace files"}
        >
          {(() => {
            let itemIndex = 0;
            return autocomplete.groups.map((group) => (
              <Fragment key={group.label ?? "built-in"}>
                {group.label !== undefined ? (
                  <div className="composer-slash-group" role="presentation" aria-hidden="true">
                    {group.label}
                  </div>
                ) : null}
                {group.items.map((item) => {
                  const index = itemIndex;
                  itemIndex += 1;
                  return (
                    <button
                      key={item.key}
                      ref={index === activeIndex ? activeItemRef : undefined}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={
                        index === activeIndex
                          ? "composer-slash-item composer-slash-item--active"
                          : "composer-slash-item"
                      }
                      onClick={() => {
                        onDraftChange(
                          draft.replace(
                            /(?:^|\s)(?:\/[^\s]*|@[^\s]*)$/,
                            (match) =>
                              `${match.startsWith(" ") ? " " : ""}${item.insertText.trimEnd()}`,
                          ),
                        );
                      }}
                    >
                      <span className="composer-slash-name">{item.primary}</span>
                      {item.secondary !== undefined && item.secondary.length > 0 ? (
                        <span className="composer-slash-desc">{item.secondary}</span>
                      ) : null}
                      {item.source !== undefined && item.source.length > 0 ? (
                        <span className="composer-slash-source">{item.source}</span>
                      ) : null}
                    </button>
                  );
                })}
              </Fragment>
            ));
          })()}
        </div>
      ) : null}
      <div className="composer-top-bar">
        <div
          className={
            inflight ? "composer-activity composer-activity--inflight" : "composer-activity"
          }
          role="status"
          aria-live="polite"
          title={inflight ? undefined : workspacePathHint}
        >
          {activityDisplay}
        </div>
        {tokenUsage !== null ? (
          <span
            className="composer-token-usage"
            title={`Context window: ${tokenUsage.used} of ${tokenUsage.size} tokens`}
          >
            {formatTokenUsage(tokenUsage)}
          </span>
        ) : null}
        <span className="composer-top-bar-hint">/ commands · @ files</span>
      </div>
      <div className="composer-input-wrap">
        <textarea
          ref={composerInputRef}
          className="composer-input"
          placeholder={composerPlaceholder}
          aria-label="Agent input"
          title="Enter to send. Shift+Enter for newline. Shift+Tab to cycle mode. Arrow up and down for prompt history."
          rows={2}
          value={draft}
          disabled={textareaDisabled}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
      </div>
      <div className="composer-footer">
        {!hideComposerModelControls ? (
          <div
            className={
              agentOrderedLayout
                ? "composer-footer-model composer-footer-config"
                : "composer-footer-model composer-footer-model--stacked"
            }
          >
            {modelPickerLocked ? (
              <span
                className="composer-pick-value"
                title={modelLabel}
                aria-label={
                  agentOrderedLayout ? `Session config: ${modelLabel}` : `Model: ${modelLabel}`
                }
              >
                {modelLabel.length > 0 ? modelLabel : "\u2014"}
              </span>
            ) : showConfigLoading ? (
              <ComposerConfigLoading />
            ) : agentOrderedLayout && toolbarConfigOptions !== null ? (
              <ConfigOptionControls
                options={toolbarConfigOptions}
                disabled={modelSelectDisabled}
                onPick={onPickSessionConfigOption}
              />
            ) : (
              <>
                {useConfigModelPicker && configModelOption !== undefined ? (
                  <div className="composer-config-field">
                    <label className="composer-config-label" htmlFor="acp-ui-model-select">
                      Model
                    </label>
                    <Dropdown
                      id="acp-ui-model-select"
                      className="composer-config-select composer-config-select--model"
                      ariaLabel="Model"
                      value={configCurrentGroupName}
                      disabled={modelSelectDisabled}
                      options={configModelGroups.map((group) => ({
                        value: group.name,
                        label: group.label,
                      }))}
                      onChange={(next) => {
                        const preferredParams = parseModelIdBracketParams(
                          configModelOption.currentValue,
                        ).params;
                        const nextModelId = pickModelOptionForFamily(
                          configModelOption,
                          next,
                          preferredParams,
                        );
                        onPickSessionConfigOption(configModelOption.configId, nextModelId);
                      }}
                    />
                  </div>
                ) : (
                  <div className="composer-config-field">
                    <label className="composer-config-label" htmlFor="acp-ui-model-select">
                      Model
                    </label>
                    <Dropdown
                      id="acp-ui-model-select"
                      className="composer-config-select composer-config-select--model"
                      ariaLabel="Model"
                      value={modelPickerState?.currentGroupName ?? ""}
                      disabled={modelSelectDisabled}
                      options={
                        modelPickerState?.groups.map((group) => ({
                          value: group.name,
                          label: group.label,
                        })) ?? []
                      }
                      onChange={(next) => {
                        if (modelSel === null || modelPickerState === null) {
                          return;
                        }
                        const group = modelPickerState.groups.find((entry) => entry.name === next);
                        if (group === undefined || group.variants.length === 0) {
                          return;
                        }
                        const preferredParams = parseModelIdBracketParams(
                          modelSel.currentModelId,
                        ).params;
                        const variants = group.variants.map((variant) => ({
                          modelId: variant.modelId,
                          params: parseModelIdBracketParams(variant.modelId).params,
                        }));
                        onPickSessionModel(pickVariantForGroup(variants, preferredParams));
                      }}
                    />
                  </div>
                )}
                {configParamOptions.length > 0 ? (
                  <ConfigOptionControls
                    options={configParamOptions}
                    disabled={modelSelectDisabled}
                    onPick={handleModelParamPick}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}
        <div className="composer-mode-slot">
          <SessionModeIndicator modeOption={modeOption} />
        </div>
        <button
          type="button"
          className="composer-cancel"
          disabled={!promptInFlight}
          onClick={() => onCancel()}
        >
          Cancel
        </button>
        <button
          type="button"
          className="composer-send"
          disabled={textareaDisabled}
          onClick={() => onSubmit()}
        >
          {sendFollowUpLabel(
            promptInFlight,
            draft.trim().length > 0 || pendingImages.length > 0,
            followUp?.mode ?? null,
          )}
        </button>
      </div>
    </footer>
    </div>
  );
}
