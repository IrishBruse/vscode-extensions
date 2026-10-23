import type { ExtensionContext } from "vscode";
import { openMarkdownInline } from "./commands/openMarkdownInline";
import { openMarkdownSource } from "./commands/openMarkdownSource";
import { Commands } from "./constants";
import { registerCommandIB } from "./lib/vscode/vscode";
import { registerMarkdownInlineEditor } from "./markdownInline/host";

export function activate(context: ExtensionContext): void {
    registerCommandIB(Commands.OpenMarkdownInline, openMarkdownInline, context);
    registerCommandIB(Commands.OpenMarkdownSource, openMarkdownSource, context);
    registerMarkdownInlineEditor(context);
}

export function deactivate(): void {}
