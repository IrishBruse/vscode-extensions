import type * as acp from "@agentclientprotocol/sdk";
import { RequestError } from "@agentclientprotocol/sdk";
import type {
    ExtensionToWebviewMessage,
    WebviewToExtensionMessage,
    AcpUiMcpServerRow,
    AcpUiPromptImage,
} from "../../protocol/extensionHostMessages";
import type { AcpAgentSpawnConfig } from "../domain/agentSpawnConfig";
import { resolveAuthMethodId } from "../domain/agentSpawnConfig";
import { AcpAgentProcess } from "../infrastructure/acpAgentProcess";
import { cursorTodosFromExtensionParams } from "../mapping/cursorTodoPresentation";
import { imagePreviewTargetFromMessage } from "../mapping/imageToolPreview";
import { canonicalToolCallId } from "../mapping/canonicalToolCallId";
import {
    type CursorChildSessionNotification,
    createToolCallKindTracking,
    extensionMessagesForPermissionRequest,
    isSubagentActivityMessage,
    messagesForCursorChildSession,
    messagesForSessionNotification,
    type ToolCallKindTracking,
} from "../mapping/sessionUpdateMapping";
import type { AcpHostFilesystem } from "../ports/hostFilesystem";
import type { AcpHostTerminal } from "../ports/hostTerminal";
import { isImageFilePath } from "../../platform/imageFilePath";
import { readWorkspaceImage } from "../../platform/readWorkspaceImage";
import type { AcpRpcNdjsonSink } from "../ports/rpcNdjsonSink";
import { readAutoApproveWebFetchAndSearch } from "../config/autoApproveWebToolsSetting";
import { LatestPromptTurn } from "./latestPromptTurn";
import { autoApproveWebToolOption } from "./webToolPermission";
import { buildModelId, parseModelIdBracketParams } from "./modelVariantPicker";
import {
    type AcpUiSessionConfigOption,
    type AcpUiSessionConfigState,
    modeConfigOption,
    modelSelectOptionFromModels,
    resolveAdvertisedModelOptionValue,
    resolveModelConfigWireValue,
    sessionConfigOptionsFromAgent,
} from "./sessionConfigOptions";
import { type AcceptedPlan, agentModeConfigValue, implementPlanPrompt } from "./implementPlan";
import {
    readCachedComposerSeed,
    writeCachedSessionConfigOptions,
    writeCachedSessionModels,
} from "./sessionConfigOptionsCache";
import {
    type AcpUiSessionModelSelection,
    sessionModelStateToAcpUiSelection,
} from "./sessionModels";
import {
    type AgentProcessExitDetails,
    formatAcpConnectionErrorMessage,
    formatAgentProcessExitMessage,
    isAcpConnectionStall,
    isAcpDisconnectError,
} from "./agentDisconnect";
import {
    type PermissionGrant,
    grantForSelectedOption,
    outcomesForMatchingGrants,
    stickyPermissionOutcome,
    upsertPermissionGrant,
} from "./permissionMemory";
import { normalizeAskQuestionAnswers } from "../cursor/askQuestion";
import { inferContextWindowSizeTokens, promptTurnTokenCount } from "./contextWindowSize";

/** Callback that forwards an extension-to-webview message to the UI host. */
export type PostToWebview = (message: ExtensionToWebviewMessage) => void;

/**
 * Host capabilities required to run an {@link AcpAgentProcess} (filesystem + RPC logging + workspace root).
 * Keeps the session bridge testable and independent of VS Code globals.
 */
export type AcpSessionHostRuntime = {
    hostFilesystem: AcpHostFilesystem;
    hostTerminal: AcpHostTerminal;
    rpcNdjsonSink: AcpRpcNdjsonSink;
    getWorkspaceRoot: () => string | undefined;
    /** MCP servers for `session/new` and `session/load`. Omit to send none. */
    loadMcpServers?: (
        capabilities: acp.McpCapabilities | undefined,
    ) => Promise<{ forwarded: acp.McpServer[]; servers: AcpUiMcpServerRow[]; note?: string }>;
};

export type AcpSessionBridgeHooks = {
    onSessionInfoUpdate?: (update: acp.SessionInfoUpdate) => void;
    /** Called immediately before `session/load` replays agent-side history. */
    onResumeSession?: () => void | Promise<void>;
    /** Called when `session/load` fails and the client falls back to `session/new`. */
    onLoadSessionFailed?: () => void | Promise<void>;
    /** Called when the agent subprocess exits and the bridge is no longer usable. */
    onAgentDisconnected?: (message: string) => void;
    /** Allow always and Reject always choices restored from the session file. */
    initialPermissionGrants?: readonly PermissionGrant[];
    /** Called when the user picks Allow always or Reject always. */
    onPermissionGrantsChanged?: (grants: readonly PermissionGrant[]) => void;
};

export type AcpSessionConnectOptions = {
    preferredModelId?: string;
    runtimeSessionId?: string;
};

/**
 * True when connect should call `session/load` instead of `session/new`.
 */
export function shouldLoadRuntimeSession(
    runtimeSessionId: string | undefined,
    supportsLoadSession: boolean,
): boolean {
    const id = runtimeSessionId?.trim();
    return id !== undefined && id.length > 0 && supportsLoadSession;
}

/**
 * Bridges a single chat session to an ACP agent process. Translates ACP session/update notifications
 * into host protocol messages and routes user prompts to the agent.
 */
export class AcpSessionBridge {
    private agentProcess: AcpAgentProcess;
    private acpSessionId: string | null = null;
    private prompting = false;
    private readonly promptTurns = new LatestPromptTurn();
    /** True after this session receives an ACP `usage_update` with a context window. */
    private contextWindowKnown = false;
    private lastModelSelection: AcpUiSessionModelSelection | null = null;
    private lastConfigOptions: AcpUiSessionConfigState | null = null;
    private toolCallKindTracking = createToolCallKindTracking();
    /** Tool-kind maps for child sessions, keyed by the child session id. */
    private childToolCallKindTracking = new Map<string, ToolCallKindTracking>();
    /** Read tool calls awaiting `fs/readTextFile` path correlation (FIFO). */
    private readToolCallQueue: string[] = [];
    private nextPermissionRequestId = 0;
    private permissionGrants: PermissionGrant[];
    private pendingPermissionRequests = new Map<string, acp.RequestPermissionRequest>();
    private permissionWaiters = new Map<string, (outcome: acp.RequestPermissionResponse) => void>();
    private nextCursorExtensionRequestId = 0;
    private askQuestionWaiters = new Map<string, (result: Record<string, unknown>) => void>();
    private createPlanWaiters = new Map<string, (result: Record<string, unknown>) => void>();
    private pendingCreatePlans = new Map<string, AcceptedPlan>();
    /** Set when the user accepts a plan. The next completed turn implements it in agent mode. */
    private planToImplement: AcceptedPlan | undefined;

    constructor(
        private readonly config: AcpAgentSpawnConfig,
        private readonly postToWebview: PostToWebview,
        private readonly host: AcpSessionHostRuntime,
        private readonly hooks?: AcpSessionBridgeHooks,
    ) {
        this.permissionGrants = [...(hooks?.initialPermissionGrants ?? [])];
        this.agentProcess = new AcpAgentProcess({
            config,
            requestPermission: (params) => this.queuePermissionRequest(params),
            extMethod: (method, params) => this.handleExtensionMethod(method, params),
            extNotification: (method, params) => this.handleExtensionNotification(method, params),
            hostFilesystem: host.hostFilesystem,
            hostTerminal: host.hostTerminal,
            rpcNdjsonSink: host.rpcNdjsonSink,
            getWorkspaceRoot: host.getWorkspaceRoot,
            onHostFilesystemRead: (path) => this.handleHostFilesystemRead(path),
            onProcessExit: (details) => this.handleAgentProcessExit(details),
        });
        this.agentProcess.onSessionUpdate((params) => this.handleSessionUpdate(params));
        this.agentProcess.onCursorChildSession((params) => this.handleCursorChildSession(params));
    }

    /** Whether the underlying ACP agent subprocess is still running. */
    isAgentAlive(): boolean {
        return this.agentProcess.isAlive();
    }

    private permissionTrackedKind(toolCall: acp.ToolCallUpdate): string | undefined {
        const toolCallId =
            typeof toolCall.toolCallId === "string" ? canonicalToolCallId(toolCall.toolCallId) : "";
        if (toolCallId.length === 0) {
            return undefined;
        }
        return this.toolCallKindTracking.kindByToolId.get(toolCallId);
    }

    private async queuePermissionRequest(
        params: acp.RequestPermissionRequest,
    ): Promise<acp.RequestPermissionResponse> {
        const trackedKind = this.permissionTrackedKind(params.toolCall);
        if (readAutoApproveWebFetchAndSearch()) {
            const option = autoApproveWebToolOption(params);
            if (option !== undefined) {
                for (const msg of extensionMessagesForPermissionRequest("perm-web-auto", params)) {
                    if (msg.type !== "permissionRequest") {
                        this.postSessionOrChild(params.sessionId, msg);
                    }
                }
                return { outcome: { outcome: "selected", optionId: option.optionId } };
            }
        }
        const remembered = stickyPermissionOutcome(this.permissionGrants, params, trackedKind);
        if (remembered !== undefined) {
            for (const msg of extensionMessagesForPermissionRequest("perm-remembered", params)) {
                if (msg.type !== "permissionRequest") {
                    this.postSessionOrChild(params.sessionId, msg);
                }
            }
            return remembered;
        }
        const requestId = `perm-${this.nextPermissionRequestId++}`;
        return new Promise((resolve) => {
            this.permissionWaiters.set(requestId, resolve);
            this.pendingPermissionRequests.set(requestId, params);
            for (const msg of extensionMessagesForPermissionRequest(requestId, params)) {
                this.postSessionOrChild(params.sessionId, msg);
            }
        });
    }

    /** Keeps a child permission's tool row on that child. The dialog stays on the parent chat. */
    private postSessionOrChild(sessionId: string, message: ExtensionToWebviewMessage): void {
        const child =
            this.acpSessionId !== null &&
            sessionId !== this.acpSessionId &&
            message.type !== "permissionRequest" &&
            isSubagentActivityMessage(message);
        if (child) {
            this.postToWebview({ type: "subagentActivity", sessionId, event: message });
            return;
        }
        this.postToWebview(message);
    }

    /**
     * Completes a pending `session/request_permission` from the UI (e.g. webview dialog).
     */
    handlePermissionResponse(
        message: Extract<WebviewToExtensionMessage, { type: "permissionResponse" }>,
    ): void {
        const resolve = this.permissionWaiters.get(message.requestId);
        if (resolve === undefined) {
            return;
        }
        this.permissionWaiters.delete(message.requestId);
        const request = this.pendingPermissionRequests.get(message.requestId);
        this.pendingPermissionRequests.delete(message.requestId);
        if ("cancelled" in message && message.cancelled === true) {
            resolve({ outcome: { outcome: "cancelled" } });
            this.showNextPendingPermission();
            return;
        }
        if ("selectedOptionId" in message) {
            if (request !== undefined) {
                const grant = grantForSelectedOption(
                    request,
                    message.selectedOptionId,
                    this.permissionTrackedKind(request.toolCall),
                );
                if (grant !== undefined) {
                    this.permissionGrants = upsertPermissionGrant(this.permissionGrants, grant);
                    this.hooks?.onPermissionGrantsChanged?.(this.permissionGrants);
                    this.resolveGrantedPendingRequests(message.requestId);
                }
            }
            resolve({
                outcome: {
                    outcome: "selected",
                    optionId: message.selectedOptionId,
                },
            });
            this.showNextPendingPermission();
            return;
        }
        resolve({ outcome: { outcome: "cancelled" } });
        this.showNextPendingPermission();
    }

    /** Allow always and Reject always also answer requests that are already waiting. */
    private resolveGrantedPendingRequests(exceptRequestId: string): void {
        const matches = outcomesForMatchingGrants(
            this.permissionGrants,
            this.pendingPermissionRequests,
            exceptRequestId,
            (pending) => this.permissionTrackedKind(pending.toolCall),
        );
        for (const match of matches) {
            const resolve = this.permissionWaiters.get(match.requestId);
            this.permissionWaiters.delete(match.requestId);
            this.pendingPermissionRequests.delete(match.requestId);
            resolve?.(match.outcome);
            this.postToWebview({ type: "permissionSettled", requestId: match.requestId });
        }
    }

    /** The dialog shows one request. After it is answered, show the next different one. */
    private showNextPendingPermission(): void {
        const next = this.pendingPermissionRequests.entries().next();
        if (next.done) {
            return;
        }
        const [requestId, params] = next.value;
        for (const msg of extensionMessagesForPermissionRequest(requestId, params)) {
            this.postSessionOrChild(params.sessionId, msg);
        }
    }

    handleCursorAskQuestionResponse(
        message: Extract<WebviewToExtensionMessage, { type: "cursorAskQuestionResponse" }>,
    ): void {
        const resolve = this.askQuestionWaiters.get(message.requestId);
        if (resolve === undefined) {
            return;
        }
        this.askQuestionWaiters.delete(message.requestId);
        const outcome = message.outcome;
        if (outcome.outcome === "answered") {
            resolve({
                outcome: {
                    outcome: "answered",
                    answers: normalizeAskQuestionAnswers(outcome.answers),
                },
            });
            return;
        }
        resolve({ outcome });
    }

    handleCursorCreatePlanResponse(
        message: Extract<WebviewToExtensionMessage, { type: "cursorCreatePlanResponse" }>,
    ): void {
        const resolve = this.createPlanWaiters.get(message.requestId);
        if (resolve === undefined) {
            return;
        }
        this.createPlanWaiters.delete(message.requestId);
        const plan = this.pendingCreatePlans.get(message.requestId);
        this.pendingCreatePlans.delete(message.requestId);
        if (message.outcome.outcome === "accepted" && plan !== undefined) {
            this.planToImplement = plan;
        }
        resolve({ outcome: message.outcome });
    }

    private cancelPendingPermissions(): void {
        for (const resolve of this.permissionWaiters.values()) {
            resolve({ outcome: { outcome: "cancelled" } });
        }
        this.permissionWaiters.clear();
        this.pendingPermissionRequests.clear();
    }

    private cancelPendingExtensionRequests(): void {
        for (const resolve of this.askQuestionWaiters.values()) {
            resolve({ outcome: { outcome: "cancelled" } });
        }
        this.askQuestionWaiters.clear();
        for (const resolve of this.createPlanWaiters.values()) {
            resolve({ outcome: { outcome: "cancelled" } });
        }
        this.createPlanWaiters.clear();
        this.pendingCreatePlans.clear();
        this.planToImplement = undefined;
    }

    private nextCursorRequestId(prefix: string): string {
        const next = this.nextCursorExtensionRequestId++;
        return `${prefix}-${next}`;
    }

    private async handleExtensionMethod(
        method: string,
        params: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        if (method === "cursor/ask_question") {
            const requestId = this.nextCursorRequestId("cursor-ask-question");
            const questionsRaw = params.questions;
            const questions = Array.isArray(questionsRaw)
                ? questionsRaw
                      .map((q) => {
                          if (q === null || typeof q !== "object") {
                              return null;
                          }
                          const record = q as Record<string, unknown>;
                          const id = typeof record.id === "string" ? record.id.trim() : "";
                          const prompt =
                              typeof record.prompt === "string" ? record.prompt.trim() : "";
                          const optionsRaw = record.options;
                          const options = Array.isArray(optionsRaw)
                              ? optionsRaw
                                    .map((o) => {
                                        if (o === null || typeof o !== "object") {
                                            return null;
                                        }
                                        const option = o as Record<string, unknown>;
                                        const optionId =
                                            typeof option.id === "string" ? option.id.trim() : "";
                                        const label =
                                            typeof option.label === "string"
                                                ? option.label.trim()
                                                : "";
                                        if (optionId.length === 0 || label.length === 0) {
                                            return null;
                                        }
                                        return { id: optionId, label };
                                    })
                                    .filter((o): o is { id: string; label: string } => o !== null)
                              : [];
                          if (id.length === 0 || prompt.length === 0 || options.length === 0) {
                              return null;
                          }
                          return {
                              id,
                              prompt,
                              options,
                              ...(record.allowMultiple === true ? { allowMultiple: true } : {}),
                          };
                      })
                      .filter((q): q is NonNullable<typeof q> => q !== null)
                : [];
            if (questions.length === 0) {
                return { outcome: { outcome: "cancelled" } };
            }
            this.postToWebview({
                type: "cursorAskQuestionRequest",
                requestId,
                ...(typeof params.title === "string" && params.title.trim().length > 0
                    ? { title: params.title.trim() }
                    : {}),
                questions,
            });
            return await new Promise((resolve) => {
                this.askQuestionWaiters.set(requestId, resolve);
            });
        }
        if (method === "cursor/create_plan") {
            const requestId = this.nextCursorRequestId("cursor-create-plan");
            const plan = typeof params.plan === "string" ? params.plan.trim() : "";
            if (plan.length === 0) {
                return { outcome: { outcome: "cancelled" } };
            }
            const todos = Array.isArray(params.todos)
                ? (params.todos as unknown[])
                      .map((todo) => {
                          if (todo === null || typeof todo !== "object") {
                              return null;
                          }
                          const record = todo as Record<string, unknown>;
                          if (
                              typeof record.id !== "string" ||
                              typeof record.content !== "string" ||
                              typeof record.status !== "string"
                          ) {
                              return null;
                          }
                          const statusRaw = record.status;
                          if (
                              statusRaw !== "pending" &&
                              statusRaw !== "in_progress" &&
                              statusRaw !== "completed" &&
                              statusRaw !== "cancelled"
                          ) {
                              return null;
                          }
                          const status: "pending" | "in_progress" | "completed" | "cancelled" =
                              statusRaw;
                          return {
                              id: record.id,
                              content: record.content,
                              status,
                          };
                      })
                      .filter((todo): todo is NonNullable<typeof todo> => todo !== null)
                : [];
            this.pendingCreatePlans.set(requestId, {
                plan,
                ...(typeof params.name === "string" && params.name.trim().length > 0
                    ? { name: params.name.trim() }
                    : {}),
            });
            this.postToWebview({
                type: "cursorCreatePlanRequest",
                requestId,
                ...(typeof params.name === "string" && params.name.length > 0
                    ? { name: params.name }
                    : {}),
                ...(typeof params.overview === "string" && params.overview.length > 0
                    ? { overview: params.overview }
                    : {}),
                plan,
                todos,
                ...(params.isProject === true ? { isProject: true } : {}),
            });
            return await new Promise((resolve) => {
                this.createPlanWaiters.set(requestId, resolve);
            });
        }
        if (method === "cursor/update_todos") {
            this.postCursorUpdateTodos(params);
            return {};
        }
        return {};
    }

    private postCursorUpdateTodos(params: Record<string, unknown>): void {
        const parsed = cursorTodosFromExtensionParams(params);
        if (parsed === undefined) {
            return;
        }
        this.postToWebview({
            type: "cursorUpdateTodos",
            toolCallId: parsed.toolCallId,
            todos: parsed.todos,
            merge: parsed.merge,
        });
    }

    private async handleExtensionNotification(
        method: string,
        params: Record<string, unknown>,
    ): Promise<void> {
        if (method === "cursor/update_todos") {
            this.postCursorUpdateTodos(params);
            return;
        }
        if (method === "cursor/task") {
            const rawSubagentType = params.subagentType;
            const subagentType =
                typeof rawSubagentType === "string"
                    ? rawSubagentType
                    : rawSubagentType !== null &&
                        typeof rawSubagentType === "object" &&
                        typeof (rawSubagentType as { custom?: unknown }).custom === "string"
                      ? (rawSubagentType as { custom: string }).custom
                      : "unspecified";
            this.postToWebview({
                type: "cursorTask",
                toolCallId:
                    typeof params.toolCallId === "string" ? params.toolCallId : "cursor-task",
                description: typeof params.description === "string" ? params.description : "Task",
                prompt: typeof params.prompt === "string" ? params.prompt : "",
                subagentType,
                ...(typeof params.model === "string" ? { model: params.model } : {}),
                ...(typeof params.agentId === "string" ? { agentId: params.agentId } : {}),
                ...(typeof params.durationMs === "number" ? { durationMs: params.durationMs } : {}),
            });
            return;
        }
        if (method === "cursor/generate_image") {
            this.postToWebview({
                type: "cursorGenerateImage",
                toolCallId:
                    typeof params.toolCallId === "string"
                        ? params.toolCallId
                        : "cursor-generate-image",
                description:
                    typeof params.description === "string" ? params.description : "Generated image",
                ...(typeof params.filePath === "string" ? { filePath: params.filePath } : {}),
                ...(Array.isArray(params.referenceImagePaths)
                    ? {
                          referenceImagePaths: (params.referenceImagePaths as unknown[]).filter(
                              (p): p is string => typeof p === "string",
                          ),
                      }
                    : {}),
            });
        }
    }

    /**
     * Starts the agent process and creates or loads an ACP session. If `preferredModelId` is set and the
     * session advertises models, applies it before the first `sessionModels` message to the UI.
     */
    async connect(options?: AcpSessionConnectOptions): Promise<void> {
        this.seedConfigOptionsBeforeConnect();
        this.contextWindowKnown = false;
        const init = await this.agentProcess.start();
        this.postToWebview({
            type: "promptImageSupport",
            supported: this.agentProcess.supportsImagePrompt(),
        });
        await this.ensureAuthenticated(init);
        const mcpServers = await this.mcpServersForSession(init);
        const runtimeSessionId = options?.runtimeSessionId?.trim();
        const useLoad = shouldLoadRuntimeSession(
            runtimeSessionId,
            this.agentProcess.supportsLoadSession(),
        );
        let bootstrap: acp.NewSessionResponse | acp.LoadSessionResponse;
        if (useLoad && runtimeSessionId !== undefined) {
            await this.hooks?.onResumeSession?.();
            try {
                bootstrap = await this.loadSessionWithAuthRetry(init, runtimeSessionId, mcpServers);
                this.setParentSessionId(runtimeSessionId);
            } catch {
                await this.hooks?.onLoadSessionFailed?.();
                const created = await this.newSessionWithAuthRetry(init, mcpServers);
                bootstrap = created;
                this.setParentSessionId(created.sessionId);
            }
        } else {
            const created = await this.newSessionWithAuthRetry(init, mcpServers);
            bootstrap = created;
            this.setParentSessionId(created.sessionId);
        }
        const preferredModelId = options?.preferredModelId;
        if (bootstrap.configOptions !== undefined && bootstrap.configOptions !== null) {
            this.applyConfigOptions(bootstrap.configOptions);
        } else if (bootstrap.modes) {
            let state = bootstrap.modes;
            if (
                preferredModelId !== undefined &&
                preferredModelId !== state.currentModeId &&
                this.acpSessionId !== null
            ) {
                try {
                    await this.agentProcess.setSessionModel(this.acpSessionId, preferredModelId);
                    state = { ...state, currentModeId: preferredModelId };
                } catch {}
            }
            const selection = sessionModelStateToAcpUiSelection(state);
            this.lastModelSelection = selection;
            writeCachedSessionModels(this.config.name, selection);
            this.postToWebview({ type: "sessionModels", ...selection });
            this.publishInferredContextWindow();
        }
        if (
            bootstrap.configOptions !== undefined &&
            bootstrap.configOptions !== null &&
            bootstrap.modes &&
            preferredModelId !== undefined
        ) {
            const modelOption = this.lastConfigOptions?.options.find(
                (option) => option.type === "select" && option.category === "model",
            );
            if (modelOption?.type === "select" && preferredModelId !== modelOption.currentValue) {
                try {
                    await this.setSessionConfigOption(modelOption.configId, preferredModelId);
                } catch {}
            }
        }
    }

    /** Updates the session model when the agent supports `session/set_model`. */
    async setSessionModel(modelId: string): Promise<void> {
        if (!this.acpSessionId) {
            return;
        }
        const modelConfig = this.lastConfigOptions?.options.find(
            (option) => option.type === "select" && option.category === "model",
        );
        if (modelConfig?.type === "select") {
            const wireValue = resolveModelConfigWireValue(modelConfig, modelId);
            await this.applySessionModelWireValue(modelConfig.configId, wireValue);
            return;
        }
        const advertisedId = this.resolveUnstableModelId(modelId);
        const wireModelId =
            advertisedId ??
            (this.lastModelSelection !== null
                ? resolveModelConfigWireValue(
                      modelSelectOptionFromModels(this.lastModelSelection),
                      modelId,
                  )
                : modelId);
        await this.agentProcess.setSessionModel(this.acpSessionId, wireModelId);
        this.syncModelSelectionAfterWire(wireModelId);
    }

    /** Updates a session config option via `session/set_config_option`. */
    async setSessionConfigOption(configId: string, value: string | boolean): Promise<void> {
        if (!this.acpSessionId) {
            return;
        }
        const modelConfig = this.lastConfigOptions?.options.find(
            (option) => option.type === "select" && option.category === "model",
        );
        let wireValue: string | boolean = value;
        if (
            typeof value === "string" &&
            modelConfig?.type === "select" &&
            configId === modelConfig.configId
        ) {
            wireValue = resolveModelConfigWireValue(modelConfig, value);
            await this.applySessionModelWireValue(configId, wireValue);
            return;
        }
        const response = await this.agentProcess.setSessionConfigOption(
            typeof wireValue === "boolean"
                ? {
                      sessionId: this.acpSessionId,
                      configId,
                      type: "boolean",
                      value: wireValue,
                  }
                : {
                      sessionId: this.acpSessionId,
                      configId,
                      value: wireValue,
                  },
        );
        this.applyConfigOptions(response.configOptions);
    }

    /**
     * Applies a model id via `set_config_option` when advertised, otherwise
     * `setSessionMode` for composed bracket ids the agent omits.
     */
    private async applySessionModelWireValue(configId: string, wireValue: string): Promise<void> {
        if (!this.acpSessionId) {
            return;
        }
        const modelConfig = this.lastConfigOptions?.options.find(
            (option) =>
                option.type === "select" &&
                option.category === "model" &&
                option.configId === configId,
        );
        if (modelConfig?.type === "select") {
            const advertised = resolveAdvertisedModelOptionValue(modelConfig, wireValue);
            if (advertised !== null) {
                const response = await this.agentProcess.setSessionConfigOption({
                    sessionId: this.acpSessionId,
                    configId,
                    value: advertised,
                });
                this.applyConfigOptions(response.configOptions);
                return;
            }
        }
        await this.setSessionModelUnadvertised(wireValue);
    }

    private async setSessionModelUnadvertised(wireValue: string): Promise<void> {
        if (!this.acpSessionId) {
            return;
        }
        const candidates = this.unadvertisedModelWireCandidates(wireValue);
        let lastError: unknown;
        for (const candidate of candidates) {
            try {
                await this.agentProcess.setSessionModel(this.acpSessionId, candidate);
                this.syncModelSelectionAfterWire(candidate);
                return;
            } catch (error: unknown) {
                lastError = error;
            }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }

    private unadvertisedModelWireCandidates(wireValue: string): string[] {
        const candidates = [wireValue];
        const parsed = parseModelIdBracketParams(wireValue);
        if (
            parsed.params.fast === undefined &&
            !candidates.includes(buildModelId(parsed.base, { ...parsed.params, fast: "false" }))
        ) {
            candidates.push(buildModelId(parsed.base, { ...parsed.params, fast: "false" }));
        }
        return candidates;
    }

    private syncModelSelectionAfterWire(wireModelId: string): void {
        if (this.lastConfigOptions !== null) {
            const options = this.lastConfigOptions.options.map((option) => {
                if (option.type === "select" && option.category === "model") {
                    return { ...option, currentValue: wireModelId };
                }
                return option;
            });
            this.lastConfigOptions = { options };
            writeCachedSessionConfigOptions(this.config.name, options);
            this.postToWebview({
                type: "sessionConfigOptions",
                options,
            });
        }
        if (this.lastModelSelection !== null) {
            const next: AcpUiSessionModelSelection = {
                ...this.lastModelSelection,
                currentModelId: wireModelId,
            };
            this.lastModelSelection = next;
            writeCachedSessionModels(this.config.name, next);
            this.postToWebview({ type: "sessionModels", ...next });
            this.publishInferredContextWindow();
        }
    }

    private resolveUnstableModelId(modelId: string): string | null {
        const available = this.lastModelSelection?.availableModels ?? [];
        if (available.some((model) => model.modelId === modelId)) {
            return modelId;
        }
        const candidate = parseModelIdBracketParams(modelId);
        const keys = Object.keys(candidate.params).sort();
        const signature = JSON.stringify(candidate.params, keys);
        const match = available.find((model) => {
            const parsed = parseModelIdBracketParams(model.modelId);
            return (
                parsed.base === candidate.base &&
                JSON.stringify(parsed.params, Object.keys(parsed.params).sort()) === signature
            );
        });
        return match?.modelId ?? null;
    }

    private publishConfigOptions(options: AcpUiSessionConfigOption[]): void {
        if (options.length === 0) {
            return;
        }
        const normalized: AcpUiSessionConfigState = { options };
        this.lastConfigOptions = normalized;
        writeCachedSessionConfigOptions(this.config.name, options);
        this.postToWebview({
            type: "sessionConfigOptions",
            options,
        });
        const modelOption = options.find(
            (option) => option.type === "select" && option.category === "model",
        );
        if (modelOption?.type === "select") {
            const selection: AcpUiSessionModelSelection = {
                currentModelId: modelOption.currentValue,
                availableModels: modelOption.options.map((choice) => ({
                    modelId: choice.value,
                    name: choice.name,
                })),
            };
            this.lastModelSelection = selection;
            writeCachedSessionModels(this.config.name, selection);
            this.postToWebview({ type: "sessionModels", ...selection });
        }
        this.publishInferredContextWindow();
    }

    private seedConfigOptionsBeforeConnect(): void {
        if (this.lastConfigOptions !== null) {
            return;
        }
        const seed = readCachedComposerSeed(this.config.name);
        if (seed.configOptions !== null) {
            this.publishConfigOptions(seed.configOptions);
            return;
        }
        if (seed.modelSelection !== null) {
            this.lastModelSelection = seed.modelSelection;
            this.postToWebview({
                type: "sessionModels",
                ...seed.modelSelection,
            });
            this.publishInferredContextWindow();
            return;
        }
        this.postToWebview({ type: "sessionConfigOptionsLoading" });
    }

    private syncConfigOptionsFromAgent(raw: ReadonlyArray<acp.SessionConfigOption>): void {
        const normalized = sessionConfigOptionsFromAgent(raw);
        if (normalized === null || normalized.options.length === 0) {
            return;
        }
        const options = normalized.options;
        this.lastConfigOptions = { options };
        writeCachedSessionConfigOptions(this.config.name, options);
        const modelOption = options.find(
            (option) => option.type === "select" && option.category === "model",
        );
        if (modelOption?.type === "select") {
            const selection: AcpUiSessionModelSelection = {
                currentModelId: modelOption.currentValue,
                availableModels: modelOption.options.map((choice) => ({
                    modelId: choice.value,
                    name: choice.name,
                })),
            };
            this.lastModelSelection = selection;
            writeCachedSessionModels(this.config.name, selection);
        }
        this.publishInferredContextWindow();
    }

    private applyConfigOptions(raw: ReadonlyArray<acp.SessionConfigOption>): void {
        const normalized = sessionConfigOptionsFromAgent(raw);
        if (normalized !== null) {
            this.publishConfigOptions(normalized.options);
        }
    }

    /**
     * Cursor ACP does not emit `usage_update`; infer the window from model config so the
     * composer can show `—/200.0k` instead of a bare dash.
     */
    private publishInferredContextWindow(): void {
        if (this.contextWindowKnown) {
            return;
        }
        const size = inferContextWindowSizeTokens(this.lastModelSelection, this.lastConfigOptions);
        if (size === null) {
            return;
        }
        this.postToWebview({ type: "tokenUsage", size });
    }

    /** Sends a user prompt. A newer prompt cancels the turn that is still running. */
    async prompt(text: string, images: readonly AcpUiPromptImage[] = []): Promise<void> {
        if (!this.acpSessionId) {
            this.postDisconnected("Agent session not connected.");
            return;
        }
        await this.promptTurns.run(
            () => this.cancel(),
            (isCurrent) => this.deliverPrompt(text, images, isCurrent),
        );
    }

    /**
     * One prompt turn, including a plan-accept follow-up.
     * A replacement prompt leaves `isCurrent` false so this turn does not clear the busy flag.
     */
    private async deliverPrompt(
        text: string,
        images: readonly AcpUiPromptImage[],
        isCurrent: () => boolean,
    ): Promise<void> {
        if (!isCurrent()) {
            return;
        }
        if (!this.acpSessionId) {
            this.postDisconnected("Agent session not connected.");
            return;
        }
        this.toolCallKindTracking = createToolCallKindTracking(
            this.toolCallKindTracking.updateTodosToolIds,
        );
        this.readToolCallQueue = [];
        this.prompting = true;
        try {
            const result = await this.agentProcess.prompt(this.acpSessionId, text, images);
            if (!isCurrent()) {
                return;
            }
            const followUp = result.stopReason === "cancelled" ? undefined : this.planToImplement;
            this.planToImplement = undefined;
            if (followUp !== undefined) {
                await this.switchSessionToAgentMode();
                if (!isCurrent()) {
                    return;
                }
                await this.deliverPrompt(implementPlanPrompt(followUp), [], isCurrent);
                return;
            }
            const reportedTokens = promptTurnTokenCount(result.usage);
            const inferredSize = this.contextWindowKnown
                ? null
                : inferContextWindowSizeTokens(this.lastModelSelection, this.lastConfigOptions);
            if (reportedTokens !== null || inferredSize !== null) {
                this.postToWebview({
                    type: "tokenUsage",
                    ...(reportedTokens !== null ? { used: reportedTokens } : {}),
                    ...(inferredSize !== null ? { size: inferredSize } : {}),
                });
            } else if (!this.contextWindowKnown) {
                this.publishInferredContextWindow();
            }
            if (!isCurrent()) {
                return;
            }
            this.postToWebview({
                type: "turnComplete",
                stopReason: result.stopReason,
            });
        } catch (err: unknown) {
            if (!isCurrent()) {
                return;
            }
            const raw = err instanceof Error ? err.message : String(err);
            const stalled = isAcpConnectionStall(raw);
            const message = formatAcpConnectionErrorMessage(this.config.name, raw);
            this.postToWebview({
                type: "error",
                message,
                disconnected: isAcpDisconnectError(raw),
                ...(stalled ? { stalled: true } : {}),
            });
        } finally {
            if (isCurrent()) {
                this.prompting = false;
            }
        }
    }

    private postDisconnected(detail: string): void {
        this.postToWebview({
            type: "error",
            message: formatAcpConnectionErrorMessage(this.config.name, detail),
            disconnected: true,
        });
    }

    /** Moves a plan-mode session to the agent mode that can edit and run tools. */
    private async switchSessionToAgentMode(): Promise<void> {
        const mode = modeConfigOption(this.lastConfigOptions);
        const value = agentModeConfigValue(
            mode?.options.map((option) => option.value) ?? ["agent"],
        );
        if (mode !== undefined && mode.currentValue === value) {
            return;
        }
        await this.setSessionConfigOption(mode?.configId ?? "mode", value);
    }

    /** Cancels the current prompt turn, if one is in progress. */
    async cancel(): Promise<void> {
        this.planToImplement = undefined;
        this.cancelPendingPermissions();
        this.cancelPendingExtensionRequests();
        if (!this.prompting || !this.acpSessionId) {
            return;
        }
        await this.agentProcess.cancel(this.acpSessionId);
    }

    /** Whether a prompt is currently in flight. */
    get isPrompting(): boolean {
        return this.prompting;
    }

    /** ACP session id after `connect`, used for persistence/restore metadata. */
    get sessionId(): string | null {
        return this.acpSessionId;
    }

    /** Kills the agent process and releases resources. */
    dispose(): void {
        this.cancelPendingPermissions();
        this.cancelPendingExtensionRequests();
        void this.logoutBestEffort();
        this.agentProcess.dispose();
        this.setParentSessionId(null);
    }

    private async ensureAuthenticated(init: acp.InitializeResponse): Promise<void> {
        const methodId = resolveAuthMethodId(init.authMethods, this.config.authMethodId);
        if (methodId === undefined) {
            return;
        }
        try {
            await this.agentProcess.authenticate(methodId);
        } catch (err: unknown) {
            const detail = err instanceof Error ? err.message : String(err);
            throw new Error(
                `Authentication failed for agent "${this.config.name}" (methodId="${methodId}"): ${detail}. Try running agent login or set ib-acp-ui.agents authMethodId.`,
            );
        }
    }

    private async mcpServersForSession(init: acp.InitializeResponse): Promise<acp.McpServer[]> {
        const report = await this.host.loadMcpServers?.(init.agentCapabilities?.mcpCapabilities);
        this.postToWebview({
            type: "mcpServers",
            servers: report?.servers ?? [],
            ...(report?.note !== undefined && report.note.length > 0 ? { note: report.note } : {}),
        });
        return report?.forwarded ?? [];
    }

    private async newSessionWithAuthRetry(
        init: acp.InitializeResponse,
        mcpServers: acp.McpServer[],
    ): Promise<acp.NewSessionResponse> {
        try {
            return await this.agentProcess.newSession(mcpServers);
        } catch (err: unknown) {
            if (!isAuthRequiredError(err)) {
                throw err;
            }
            await this.ensureAuthenticated(init);
            return await this.agentProcess.newSession(mcpServers);
        }
    }

    private async loadSessionWithAuthRetry(
        init: acp.InitializeResponse,
        runtimeSessionId: string,
        mcpServers: acp.McpServer[],
    ): Promise<acp.LoadSessionResponse> {
        try {
            return await this.agentProcess.loadSession(runtimeSessionId, mcpServers);
        } catch (err: unknown) {
            if (!isAuthRequiredError(err)) {
                throw err;
            }
            await this.ensureAuthenticated(init);
            return await this.agentProcess.loadSession(runtimeSessionId, mcpServers);
        }
    }

    private async logoutBestEffort(): Promise<void> {
        if (!this.agentProcess.supportsLogout()) {
            return;
        }
        try {
            await this.agentProcess.logout();
        } catch (err: unknown) {
            const detail = err instanceof Error ? err.message : String(err);
            console.warn(`[ACP Agent ${this.config.name}] logout failed: ${detail}`);
        }
    }

    private handleAgentProcessExit(details: AgentProcessExitDetails): void {
        this.setParentSessionId(null);
        this.prompting = false;
        const message = formatAgentProcessExitMessage(this.config.name, details);
        this.postToWebview({
            type: "error",
            message,
            disconnected: true,
        });
        this.hooks?.onAgentDisconnected?.(message);
    }

    private setParentSessionId(sessionId: string | null): void {
        this.acpSessionId = sessionId;
        this.childToolCallKindTracking.clear();
    }

    private childKindTracking(sessionId: string): ToolCallKindTracking {
        const existing = this.childToolCallKindTracking.get(sessionId);
        if (existing !== undefined) {
            return existing;
        }
        const created = createToolCallKindTracking();
        this.childToolCallKindTracking.set(sessionId, created);
        return created;
    }

    /** Cursor child sessions the ACP v1 schema drops. One child stays on its task card. */
    private handleCursorChildSession(params: CursorChildSessionNotification): void {
        for (const message of messagesForCursorChildSession(params, this.acpSessionId)) {
            this.postToWebview(message);
        }
    }

    private handleSessionUpdate(params: acp.SessionNotification): void {
        const child =
            this.acpSessionId !== null &&
            params.sessionId !== this.acpSessionId &&
            params.update.sessionUpdate !== "subagent_update";
        if (!child) {
            if (params.update.sessionUpdate === "session_info_update") {
                this.hooks?.onSessionInfoUpdate?.(params.update);
            }
            if (
                params.update.sessionUpdate === "usage_update" &&
                Number.isFinite(params.update.used) &&
                Number.isFinite(params.update.size)
            ) {
                this.contextWindowKnown = true;
            }
            if (params.update.sessionUpdate === "config_option_update") {
                this.syncConfigOptionsFromAgent(params.update.configOptions);
            }
            this.trackReadToolCallForFilesystemCorrelation(params.update);
        }
        const tracking = child
            ? this.childKindTracking(params.sessionId)
            : this.toolCallKindTracking;
        const messages = messagesForSessionNotification(params, this.acpSessionId, tracking);
        for (const msg of messages) {
            this.postToWebview(msg);
            this.queueImagePreview(msg);
        }
    }

    /** Loads a file preview when a read targets an image and the tool result had no image bytes. */
    private queueImagePreview(message: ExtensionToWebviewMessage): void {
        const target = imagePreviewTargetFromMessage(message);
        if (target === undefined) {
            return;
        }
        void this.loadImagePreview(target.toolCallId, target.path, target.sessionId);
    }

    private async loadImagePreview(
        toolCallId: string,
        path: string,
        sessionId: string | undefined,
    ): Promise<void> {
        const filesystem = this.host.hostFilesystem;
        if (filesystem.readBytes === undefined) {
            return;
        }
        const image = await readWorkspaceImage(path, this.host.getWorkspaceRoot(), (absolutePath) =>
            filesystem.readBytes!(absolutePath),
        );
        if (image === undefined) {
            return;
        }
        const event = { type: "toolImage" as const, toolCallId, image };
        if (sessionId !== undefined) {
            this.postToWebview({ type: "subagentActivity", sessionId, event });
            return;
        }
        this.postToWebview(event);
    }

    private trackReadToolCallForFilesystemCorrelation(update: acp.SessionUpdate): void {
        if (update.sessionUpdate === "tool_call") {
            if (update.kind === "read") {
                this.readToolCallQueue.push(canonicalToolCallId(update.toolCallId));
            }
            return;
        }
        if (update.sessionUpdate !== "tool_call_update") {
            return;
        }
        const status = update.status;
        if (status !== "completed" && status !== "failed") {
            return;
        }
        const toolCallId = canonicalToolCallId(update.toolCallId);
        const kind = update.kind ?? this.toolCallKindTracking.kindByToolId.get(toolCallId);
        if (kind !== "read") {
            return;
        }
        this.readToolCallQueue = this.readToolCallQueue.filter((id) => id !== toolCallId);
    }

    private handleHostFilesystemRead(path: string): void {
        const trimmed = path.trim();
        if (trimmed.length === 0) {
            return;
        }
        const toolCallId = this.readToolCallQueue[0];
        if (toolCallId === undefined) {
            return;
        }
        this.postToWebview({
            type: "updateToolCall",
            toolCallId,
            status: "in_progress",
            subtitle: trimmed,
        });
        if (isImageFilePath(trimmed)) {
            void this.loadImagePreview(toolCallId, trimmed, undefined);
        }
    }
}

function isAuthRequiredError(err: unknown): boolean {
    return err instanceof RequestError && err.code === -32000;
}
