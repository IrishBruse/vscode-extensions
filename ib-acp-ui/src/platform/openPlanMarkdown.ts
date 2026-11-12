import { commands, FileType, Uri, workspace } from "vscode";
import { planMarkdownDirectoryName } from "./planMarkdownPath";
import { resolveUserHomeDir } from "./resolveUserHomeDir";

async function ensureDirectory(uri: Uri): Promise<void> {
    try {
        const stat = await workspace.fs.stat(uri);
        if (stat.type === FileType.Directory) {
            return;
        }
    } catch {
        await workspace.fs.createDirectory(uri);
    }
}

/** Writes the plan as `plan.md` and opens that file in the editor. */
export async function openPlanMarkdownInEditor(args: {
    name?: string;
    requestId: string;
    plan: string;
}): Promise<Uri> {
    const home = Uri.file(resolveUserHomeDir());
    const cursorDir = Uri.joinPath(home, ".cursor");
    const plansDir = Uri.joinPath(cursorDir, "plans");
    const planDir = Uri.joinPath(plansDir, planMarkdownDirectoryName(args.name, args.requestId));
    await ensureDirectory(cursorDir);
    await ensureDirectory(plansDir);
    await ensureDirectory(planDir);
    const file = Uri.joinPath(planDir, "plan.md");
    const text = args.plan.endsWith("\n") ? args.plan : `${args.plan}\n`;
    await workspace.fs.writeFile(file, new TextEncoder().encode(text));
    await commands.executeCommand("vscode.open", file);
    return file;
}
