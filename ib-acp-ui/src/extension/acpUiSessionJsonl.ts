import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { type ExtensionContext, FileType, Range, Uri, WorkspaceEdit, workspace } from "vscode";
import { type AcpUiVisibleTraceItem, normalizeVisibleTrace } from "../protocol/visibleTrace";
import type { PermissionGrant } from "../acp/session/permissionMemory";
import {
    ACP_UI_SESSION_FILE_SUFFIX,
    ACP_UI_SESSION_SCHEMA,
    type AcpUiSessionDocument,
    type AcpUiSessionModelConfig,
    enqueueSessionFileWrite,
    normalizeSessionModelConfig,
    normalizeUserMessageHistory,
    parseSessionDocument,
    serializeSessionDocument,
    sessionFileNameForId,
} from "./acpUiSessionJsonlFormat";

export {
    ACP_UI_SESSION_FILE_SUFFIX,
    ACP_UI_SESSION_SCHEMA,
    type AcpUiSessionDocument,
    type AcpUiSessionHeader,
    type AcpUiSessionMetadata,
    type AcpUiSessionModelConfig,
    enqueueSessionFileWrite,
    normalizeUserMessageHistory,
    applySavedModelConfig,
    modelConfigFromSessionOptions,
    normalizeSessionModelConfig,
    parseSessionDocument,
    parseSessionFile,
    parseSessionHeaderBlock,
    parseSessionHeaderLine,
    serializeSessionDocument,
    sessionFileNameForId,
    shouldDeferJsonlHistoryReplay,
} from "./acpUiSessionJsonlFormat";

/**
 * Client-owned session files (`acpUi/session/1`) store session metadata,
 * composer user message history, the viewport transcript under `cache`, `modelConfig`, and `permissionGrants`.
 */
const sessionsDirectorySettingKey = "ib-acp-ui.sessionsDirectory";
const chatsSubdir = "chats";

let logWarn: ((message: string) => void) | null = null;

export function setAcpUiSessionJsonlLogger(log?: (message: string) => void): void {
    logWarn = log ?? null;
}

/**
 * Resolves the directory where chat `.acp` files are stored.
 */
export function resolveSessionsDirectoryUri(context: ExtensionContext): Uri {
    const configured = workspace
        .getConfiguration()
        .get<string>(sessionsDirectorySettingKey, "")
        .trim();
    if (configured.length === 0) {
        return Uri.joinPath(context.globalStorageUri, chatsSubdir);
    }
    if (isAbsolute(configured)) {
        return Uri.file(configured);
    }
    const folder = workspace.workspaceFolders?.[0];
    if (folder === undefined) {
        logWarn?.(
            `ib-acp-ui.sessionsDirectory is workspace-relative ("${configured}") but no folder is open; using extension global storage.`,
        );
        return Uri.joinPath(context.globalStorageUri, chatsSubdir);
    }
    return Uri.joinPath(folder.uri, configured);
}

/** Resolves `chats/<sessionId>.acp`. The chat title stays in the file header. */
export function sessionFileUriForId(context: ExtensionContext, sessionId: string): Uri {
    return Uri.joinPath(resolveSessionsDirectoryUri(context), sessionFileNameForId(sessionId));
}

export async function readSessionCache(sessionFileUri: Uri): Promise<AcpUiVisibleTraceItem[]> {
    const document = await readSessionDocumentAtUri(sessionFileUri);
    return document?.cache ?? [];
}

export async function writeSessionModelConfig(
    sessionFileUri: Uri,
    config: AcpUiSessionModelConfig,
): Promise<void> {
    const normalized = normalizeSessionModelConfig(config);
    if (normalized === undefined) {
        return;
    }
    await mutateSessionDocument(sessionFileUri, (current) => {
        const merged = normalizeSessionModelConfig({
            modelId: normalized.modelId ?? current.modelConfig?.modelId,
            options:
                normalized.options.length > 0
                    ? normalized.options
                    : (current.modelConfig?.options ?? []),
        });
        if (merged === undefined) {
            return current;
        }
        return {
            ...current,
            modelConfig: merged,
            updatedAt: Date.now(),
        };
    });
}

export async function writeSessionPermissionGrants(
    sessionFileUri: Uri,
    grants: readonly PermissionGrant[],
): Promise<void> {
    await mutateSessionDocument(sessionFileUri, (current) => {
        const next: AcpUiSessionDocument = { ...current, updatedAt: Date.now() };
        if (grants.length === 0) {
            delete next.permissionGrants;
            return next;
        }
        next.permissionGrants = grants.map((grant) => ({
            scopeKey: grant.scopeKey,
            decision: grant.decision,
        }));
        return next;
    });
}

export async function clearSessionPermissionGrants(sessionFileUri: Uri): Promise<void> {
    await writeSessionPermissionGrants(sessionFileUri, []);
}

export async function clearSessionModelConfig(sessionFileUri: Uri): Promise<void> {
    await mutateSessionDocument(sessionFileUri, (current) => {
        if (current.modelConfig === undefined) {
            return current;
        }
        const next: AcpUiSessionDocument = { ...current, updatedAt: Date.now() };
        delete next.modelConfig;
        return next;
    });
}

export async function writeSessionCache(sessionFileUri: Uri, items: unknown): Promise<void> {
    const normalized = normalizeVisibleTrace(items);
    await mutateSessionDocument(sessionFileUri, (current) => {
        const next: AcpUiSessionDocument = { ...current };
        if (normalized.length === 0) {
            delete next.cache;
        } else {
            next.cache = normalized;
        }
        return next;
    });
}

async function uriExists(uri: Uri): Promise<boolean> {
    try {
        await workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

async function removeEmptyParentDirectory(context: ExtensionContext, uri: Uri): Promise<void> {
    const sessionsDir = resolveSessionsDirectoryUri(context);
    const parent = Uri.joinPath(uri, "..");
    if (parent.toString() === sessionsDir.toString()) {
        return;
    }
    try {
        const entries = await workspace.fs.readDirectory(parent);
        if (entries.length === 0) {
            await workspace.fs.delete(parent);
        }
    } catch {
        // The parent directory may already be gone.
    }
}

/**
 * Moves a chat file to `chats/<sessionId>.acp` when it still uses an older path.
 * The title in the file is left unchanged.
 */
export async function ensureSessionFileNamedById(
    context: ExtensionContext,
    uri: Uri,
    sessionId: string,
): Promise<Uri> {
    const target = sessionFileUriForId(context, sessionId);
    if (uri.toString() === target.toString()) {
        return uri;
    }
    await ensureSessionsDirectory(context);
    if (await uriExists(target)) {
        logWarn?.(
            `Chat file ${sessionFileNameForId(sessionId)} already exists; left ${uri.fsPath} in place.`,
        );
        return uri;
    }
    await workspace.fs.rename(uri, target, { overwrite: false });
    await removeEmptyParentDirectory(context, uri);
    return target;
}

async function ensureSessionsDirectory(context: ExtensionContext): Promise<Uri> {
    const dir = resolveSessionsDirectoryUri(context);
    await workspace.fs.createDirectory(dir);
    return dir;
}

function buildSessionDocument(
    title: string,
    options?: {
        agentName?: string;
        history?: string[];
        runtimeSessionId?: string;
        id?: string;
        createdAt?: number;
    },
): AcpUiSessionDocument {
    const now = Date.now();
    const history = normalizeUserMessageHistory(options?.history ?? []);
    return {
        schema: ACP_UI_SESSION_SCHEMA,
        id: options?.id ?? randomUUID(),
        title: title.trim(),
        ...(options?.agentName !== undefined && options.agentName.length > 0
            ? { agentName: options.agentName }
            : {}),
        ...(options?.runtimeSessionId !== undefined && options.runtimeSessionId.length > 0
            ? { runtimeSessionId: options.runtimeSessionId }
            : {}),
        history,
        createdAt: options?.createdAt ?? now,
        updatedAt: now,
    };
}

export async function createSessionFile(
    context: ExtensionContext,
    title: string,
    options?: {
        agentName?: string;
        history?: string[];
        runtimeSessionId?: string;
        id?: string;
        createdAt?: number;
    },
): Promise<{ id: string; uri: Uri; header: AcpUiSessionDocument }> {
    await ensureSessionsDirectory(context);
    const document = buildSessionDocument(title, options);
    const uri = sessionFileUriForId(context, document.id);
    await persistSessionDocument(uri, document);
    return { id: document.id, uri, header: document };
}

function openSessionTextDocument(uri: Uri) {
    const key = uri.toString();
    return workspace.textDocuments.find((doc) => doc.uri.toString() === key);
}

export async function readSessionTitleAtUri(uri: Uri): Promise<string | undefined> {
    const document = await readSessionDocumentAtUri(uri);
    const title = document?.title.trim() ?? "";
    return title.length > 0 ? title : undefined;
}

async function readSessionDocumentAtUri(uri: Uri): Promise<AcpUiSessionDocument | null> {
    const open = openSessionTextDocument(uri);
    if (open !== undefined) {
        return parseSessionDocument(open.getText());
    }
    try {
        const bytes = await workspace.fs.readFile(uri);
        return parseSessionDocument(Buffer.from(bytes).toString("utf8"));
    } catch {
        return null;
    }
}

export async function writeSessionFileUtf8(uri: Uri, content: string): Promise<void> {
    const open = openSessionTextDocument(uri);
    if (open !== undefined) {
        const edit = new WorkspaceEdit();
        const end = open.positionAt(open.getText().length);
        edit.replace(open.uri, new Range(open.positionAt(0), end), content);
        const applied = await workspace.applyEdit(edit);
        if (applied) {
            await open.save();
            return;
        }
    }
    await workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
}

async function persistSessionDocument(uri: Uri, document: AcpUiSessionDocument): Promise<void> {
    const content = serializeSessionDocument(document);
    await writeSessionFileUtf8(uri, content);
}

async function mutateSessionDocument(
    uri: Uri,
    apply: (current: AcpUiSessionDocument) => AcpUiSessionDocument,
): Promise<AcpUiSessionDocument | null> {
    return enqueueSessionFileWrite(uri.toString(), async () => {
        const current = await readSessionDocumentAtUri(uri);
        if (current === null) {
            return null;
        }
        const next = apply(current);
        await persistSessionDocument(uri, next);
        return next;
    });
}

/**
 * Persists composer user message history for a session.
 */
export async function updateSessionHistory(
    uri: Uri,
    entries: string[],
): Promise<AcpUiSessionDocument | null> {
    const history = normalizeUserMessageHistory(entries);
    return mutateSessionDocument(uri, (current) => ({
        ...current,
        history,
        updatedAt: Date.now(),
    }));
}

/**
 * Updates session metadata while preserving user message history.
 */
export async function updateSessionHeader(
    uri: Uri,
    patch: Partial<
        Pick<
            AcpUiSessionDocument,
            "title" | "agentName" | "runtimeSessionId" | "history" | "updatedAt"
        >
    >,
): Promise<AcpUiSessionDocument | null> {
    return mutateSessionDocument(uri, (current) => {
        const next: AcpUiSessionDocument = {
            ...current,
            ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
            ...(patch.agentName !== undefined
                ? patch.agentName.length > 0
                    ? { agentName: patch.agentName }
                    : {}
                : {}),
            ...(patch.runtimeSessionId !== undefined
                ? patch.runtimeSessionId.length > 0
                    ? { runtimeSessionId: patch.runtimeSessionId }
                    : {}
                : {}),
            ...(patch.history !== undefined
                ? { history: normalizeUserMessageHistory(patch.history) }
                : {}),
            updatedAt: patch.updatedAt ?? Date.now(),
        };
        if (
            patch.agentName !== undefined &&
            patch.agentName.length === 0 &&
            next.agentName !== undefined
        ) {
            delete next.agentName;
        }
        if (
            patch.runtimeSessionId !== undefined &&
            patch.runtimeSessionId.length === 0 &&
            next.runtimeSessionId !== undefined
        ) {
            delete next.runtimeSessionId;
        }
        return next;
    });
}

export async function deleteSessionFile(context: ExtensionContext, uri: Uri): Promise<void> {
    try {
        await workspace.fs.delete(uri, { useTrash: true });
    } catch {
        // File may already be gone.
    }
    await removeEmptyParentDirectory(context, uri);
}

async function readSessionHeaderAtUri(
    uri: Uri,
): Promise<{ header: AcpUiSessionDocument; uri: Uri } | null> {
    const document = await readSessionDocumentAtUri(uri);
    if (document !== null) {
        return { header: document, uri };
    }
    return null;
}

async function listSessionHeadersInDirectory(
    dir: Uri,
): Promise<Array<{ header: AcpUiSessionDocument; uri: Uri }>> {
    let entries: [string, FileType][];
    try {
        entries = await workspace.fs.readDirectory(dir);
    } catch {
        return [];
    }
    const out: Array<{ header: AcpUiSessionDocument; uri: Uri }> = [];
    for (const [name, fileType] of entries) {
        if (fileType === FileType.File && name.endsWith(ACP_UI_SESSION_FILE_SUFFIX)) {
            const row = await readSessionHeaderAtUri(Uri.joinPath(dir, name));
            if (row !== null) {
                out.push(row);
            }
            continue;
        }
        if (fileType !== FileType.Directory) {
            continue;
        }
        const sessionDir = Uri.joinPath(dir, name);
        let sessionEntries: [string, FileType][];
        try {
            sessionEntries = await workspace.fs.readDirectory(sessionDir);
        } catch {
            continue;
        }
        for (const [sessionFileName, sessionFileType] of sessionEntries) {
            if (
                sessionFileType !== FileType.File ||
                !sessionFileName.endsWith(ACP_UI_SESSION_FILE_SUFFIX)
            ) {
                continue;
            }
            const row = await readSessionHeaderAtUri(Uri.joinPath(sessionDir, sessionFileName));
            if (row !== null) {
                out.push(row);
            }
        }
    }
    return out;
}

/** Moves older `chats/<id>/<title>.acp` files to `chats/<id>.acp`. Titles stay in the file. */
export async function migrateSessionFilesToIdNames(context: ExtensionContext): Promise<void> {
    const rows = await listSessionHeaders(context);
    for (const row of rows) {
        try {
            await ensureSessionFileNamedById(context, row.uri, row.header.id);
        } catch {
            logWarn?.(`Failed to move chat "${row.header.title}" to ${row.header.id}.acp.`);
        }
    }
}

export async function listSessionHeaders(
    context: ExtensionContext,
): Promise<Array<{ header: AcpUiSessionDocument; uri: Uri }>> {
    const dir = resolveSessionsDirectoryUri(context);
    try {
        await workspace.fs.createDirectory(dir);
    } catch {
        return [];
    }
    const out = preferIdNamedSessionFiles(await listSessionHeadersInDirectory(dir), dir);
    out.sort((a, b) => a.header.updatedAt - b.header.updatedAt);
    return out;
}

function preferIdNamedSessionFiles(
    rows: Array<{ header: AcpUiSessionDocument; uri: Uri }>,
    sessionsDir: Uri,
): Array<{ header: AcpUiSessionDocument; uri: Uri }> {
    const byId = new Map<string, { header: AcpUiSessionDocument; uri: Uri }>();
    for (const row of rows) {
        const existing = byId.get(row.header.id);
        if (existing === undefined) {
            byId.set(row.header.id, row);
            continue;
        }
        const canonical = Uri.joinPath(sessionsDir, sessionFileNameForId(row.header.id)).toString();
        if (row.uri.toString() === canonical) {
            byId.set(row.header.id, row);
        }
    }
    return [...byId.values()];
}
