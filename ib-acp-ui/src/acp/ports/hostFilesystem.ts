/**
 * Host file operations invoked by the ACP client (`readTextFile` / `writeTextFile`).
 * Implemented by a VS Code adapter using `workspace.fs` so paths stay workspace-scoped in production
 * and can be stubbed in tests.
 */
export interface AcpHostFilesystem {
    readTextFile(path: string): Promise<string>;
    writeTextFile(path: string, content: string): Promise<void>;
    /** Raw bytes for an image preview. Optional so older test doubles keep working. */
    readBytes?(path: string): Promise<Uint8Array>;
}
