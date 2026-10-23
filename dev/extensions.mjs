import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export function getRepoRoot() {
    return repoRoot;
}

function isExtensionPackage(pkg) {
    return pkg.private !== true && Boolean(pkg.publisher) && Boolean(pkg.engines?.vscode);
}

export function listExtensions() {
    return readdirSync(repoRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
            const dir = join(repoRoot, entry.name);
            const packageJsonPath = join(dir, "package.json");
            if (!existsSync(packageJsonPath)) {
                return null;
            }

            const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
            if (!isExtensionPackage(pkg)) {
                return null;
            }

            return {
                name: pkg.name,
                displayName: pkg.displayName ?? pkg.name,
                version: pkg.version,
                dir,
                relativeDir: entry.name,
                packageJsonPath,
                changelogPath: join(dir, "CHANGELOG.md"),
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function findExtension(nameOrDir) {
    const extensions = listExtensions();
    return (
        extensions.find(
            (extension) =>
                extension.name === nameOrDir ||
                extension.relativeDir === nameOrDir ||
                extension.relativeDir === `ib-${nameOrDir}`,
        ) ?? null
    );
}

export function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
}

export function readText(path) {
    return readFileSync(path, "utf8");
}

export function writeText(path, value) {
    writeFileSync(path, value);
}
