import { commands, type Disposable, type ExtensionContext } from "vscode";

export function registerCommandIB(
    command: string,
    callback: (...args: unknown[]) => unknown,
    context: ExtensionContext,
): Disposable {
    const disposable = commands.registerCommand(command, callback);
    context.subscriptions.push(disposable);
    return disposable;
}
