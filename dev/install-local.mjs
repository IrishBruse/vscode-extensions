#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { findExtension, getRepoRoot, listExtensions, readJson } from "./extensions.mjs";
import { select } from "./ui.mjs";

const repoRoot = getRepoRoot();
const defaultCli = "code";

function parseArgs(argv) {
    const args = argv.slice(2);
    let packageName = null;
    let cli = null;
    let skipPackage = false;
    let all = false;

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--package" || arg === "-p") {
            packageName = args[index + 1] ?? null;
            index += 1;
            continue;
        }
        if (arg.startsWith("--package=")) {
            packageName = arg.slice("--package=".length);
            continue;
        }
        if (arg === "--cli") {
            cli = args[index + 1] ?? null;
            index += 1;
            continue;
        }
        if (arg.startsWith("--cli=")) {
            cli = arg.slice("--cli=".length);
            continue;
        }
        if (arg === "--skip-package") {
            skipPackage = true;
            continue;
        }
        if (arg === "--all") {
            all = true;
            continue;
        }
        if (!arg.startsWith("--") && !packageName) {
            packageName = arg;
        }
    }

    return { packageName, cli, skipPackage, all };
}

function commandExists(name) {
    try {
        execSync(`command -v ${name}`, { stdio: "pipe" });
        return true;
    } catch {
        return false;
    }
}

function resolveCli(preferred) {
    const cli = preferred || process.env.VSCODE_CLI || process.env.CODE_CLI || defaultCli;
    if (!commandExists(cli)) {
        throw new Error(`Editor CLI not found on PATH: ${cli}`);
    }
    return cli;
}

async function resolveExtensions({ packageName, all }) {
    if (all) {
        const extensions = listExtensions();
        if (extensions.length === 0) {
            throw new Error("No installable extensions found");
        }
        return extensions;
    }

    if (packageName) {
        const extension = findExtension(packageName);
        if (!extension) {
            throw new Error(`Unknown extension package: ${packageName}`);
        }
        return [extension];
    }

    const extensions = listExtensions();
    if (extensions.length === 0) {
        throw new Error("No installable extensions found");
    }

    if (extensions.length === 1) {
        return [extensions[0]];
    }

    const choice = await select(
        "Install which extension?",
        extensions.map((extension) => ({
            label: `${extension.displayName} (${extension.name} ${extension.version})`,
            value: extension.name,
        })),
    );

    return [findExtension(choice)];
}

function run(command, cwd = repoRoot) {
    console.log(`\n> ${command}`);
    execSync(command, { cwd, stdio: "inherit" });
}

function installExtension(extension, { cli, skipPackage }) {
    const pkg = readJson(extension.packageJsonPath);
    const vsixPath = join(extension.dir, `${pkg.name}-${pkg.version}.vsix`);

    if (!skipPackage) {
        run(`npm run package:vsix -w ${extension.name}`);
    }

    if (!existsSync(vsixPath)) {
        console.error(`VSIX not found: ${vsixPath}`);
        console.error("Run without --skip-package, or build package:vsix first.");
        process.exit(1);
    }

    run(`${cli} --install-extension ${JSON.stringify(vsixPath)} --force`, extension.dir);
    console.log(`\nInstalled ${vsixPath} via ${cli}`);
}

async function main() {
    if (process.env.npm_command === "install") {
        return;
    }

    const { packageName, cli: cliArg, skipPackage, all } = parseArgs(process.argv);
    if (all && packageName) {
        throw new Error("Use either --all or --package, not both.");
    }

    const extensions = await resolveExtensions({ packageName, all });
    const cli = resolveCli(cliArg);

    for (const extension of extensions) {
        installExtension(extension, { cli, skipPackage });
    }
}

void main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
