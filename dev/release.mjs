#!/usr/bin/env node
import { InteractiveBrowserCredential } from "@azure/identity";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import {
    findExtension,
    getRepoRoot,
    listExtensions,
    readJson,
    readText,
    writeJson,
    writeText,
} from "./extensions.mjs";
import { confirm, select, text } from "./ui.mjs";

const semverPattern = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
const marketplaceScope = "499b84ac-1321-427f-aa17-267ca6975798/.default";
const repoRoot = getRepoRoot();

function run(command, options = {}) {
    console.log(`\n> ${command}`);
    execSync(command, { cwd: options.cwd ?? repoRoot, stdio: "inherit", ...options });
}

function compareSemver(a, b) {
    const parse = (version) => version.split("-")[0].split(".").map(Number);
    const left = parse(a);
    const right = parse(b);

    for (let index = 0; index < 3; index += 1) {
        const diff = left[index] - right[index];
        if (diff !== 0) {
            return diff;
        }
    }

    return 0;
}

function nextVersion(current, bump) {
    const [major, minor, patch] = current.split("-")[0].split(".").map(Number);

    if (bump === "major") {
        return `${major + 1}.0.0`;
    }

    if (bump === "minor") {
        return `${major}.${minor + 1}.0`;
    }

    if (bump === "patch") {
        return `${major}.${minor}.${patch + 1}`;
    }

    return bump;
}

function fileChanged(path) {
    try {
        execSync(`git diff --quiet -- "${path}"`, { cwd: repoRoot, stdio: "ignore" });
        execSync(`git diff --cached --quiet -- "${path}"`, { cwd: repoRoot, stdio: "ignore" });
        return false;
    } catch {
        return true;
    }
}

function parseArgs(argv) {
    const args = argv.slice(2);
    const publishOnly = args.includes("--publish");
    let packageName = null;
    const rest = [];

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--publish") {
            continue;
        }
        if (arg === "--package" || arg === "-p") {
            packageName = args[index + 1] ?? null;
            index += 1;
            continue;
        }
        if (arg.startsWith("--package=")) {
            packageName = arg.slice("--package=".length);
            continue;
        }
        if (!arg.startsWith("--")) {
            rest.push(arg);
        }
    }

    return {
        versionArg: rest[0] ?? null,
        publishOnly,
        packageName,
    };
}

function changelogHasVersion(extension, version) {
    return new RegExp(`^## ${version.replaceAll(".", "\\.")}(?:\\s|$)`, "m").test(
        readText(extension.changelogPath),
    );
}

function promoteUnreleased(extension, version) {
    if (changelogHasVersion(extension, version)) {
        return;
    }

    const changelog = readText(extension.changelogPath);
    const unreleasedMatch = changelog.match(/^## Unreleased\r?\n([\s\S]*?)(?=^## |z)/m);
    if (!unreleasedMatch) {
        console.error(
            `\n${extension.relativeDir}/CHANGELOG.md is missing an "## Unreleased" section.`,
        );
        process.exit(1);
    }

    const body = unreleasedMatch[1].trim();
    if (body.length === 0) {
        console.error(
            `\n${extension.relativeDir}/CHANGELOG.md "## Unreleased" is empty. Add entries, then run release again.`,
        );
        process.exit(1);
    }

    const promoted = changelog.replace(
        /^## Unreleased\r?\n[\s\S]*?(?=^## |z)/m,
        `## Unreleased\n\n## ${version}\n\n${body}\n\n`,
    );
    writeText(extension.changelogPath, promoted);
    console.log(`Moved Unreleased entries into ## ${version}.`);
}

function prepareForStamp(extension, version) {
    promoteUnreleased(extension, version);
    run(`npm run verify -w ${extension.name}`);
}

async function promptExtension(packageName) {
    if (packageName) {
        const extension = findExtension(packageName);
        if (!extension) {
            throw new Error(`Unknown extension package: ${packageName}`);
        }
        return extension;
    }

    const extensions = listExtensions();
    if (extensions.length === 0) {
        throw new Error("No publishable extensions found");
    }

    if (extensions.length === 1) {
        return extensions[0];
    }

    const choice = await select(
        "Which extension?",
        extensions.map((extension) => ({
            label: `${extension.displayName} (${extension.name} ${extension.version})`,
            value: extension.name,
        })),
    );

    return findExtension(choice);
}

async function promptVersionBump(current) {
    const nextMinor = nextVersion(current, "minor");
    const nextPatch = nextVersion(current, "patch");
    const choice = await select(`Current version is ${current}. Which release bump?`, [
        { label: `Minor (${nextMinor})`, value: "minor" },
        { label: `Patch (${nextPatch})`, value: "patch" },
        { label: "Custom version", value: "custom" },
    ]);

    if (choice !== "custom") {
        return choice;
    }

    return text("Enter semver:", {
        validate: (answer) => (semverPattern.test(answer) ? null : `Invalid version: ${answer}`),
    });
}

function hasServicePrincipalAuth() {
    return Boolean(
        process.env.AZURE_CLIENT_ID &&
        process.env.AZURE_CLIENT_SECRET &&
        process.env.AZURE_TENANT_ID,
    );
}

async function getBrowserOAuthToken() {
    console.log(
        [
            "",
            "Opening a browser for Marketplace sign-in.",
            "Choose the personal Microsoft account that owns the publisher.",
        ].join("\n"),
    );

    const credential = new InteractiveBrowserCredential({
        clientId: "04b07795-8ddb-461a-bbee-02f9e1bf7b46",
        tenantId: process.env.AZURE_TENANT_ID ?? "organizations",
        loginHint: process.env.MARKETPLACE_LOGIN_HINT,
    });

    const token = await credential.getToken(marketplaceScope);
    if (!token?.token) {
        throw new Error("Marketplace browser sign-in did not return an access token.");
    }

    return token.token;
}

function runVscePublish(extension, env) {
    const command = hasServicePrincipalAuth()
        ? "npx @vscode/vsce publish --azure-credential --no-dependencies --skip-license"
        : "npx @vscode/vsce publish --no-dependencies --skip-license";

    console.log(`\n> ${command}`);

    try {
        const outputText = execSync(command, {
            cwd: extension.dir,
            encoding: "utf8",
            env,
            stdio: ["inherit", "pipe", "pipe"],
        });

        if (outputText) {
            process.stdout.write(outputText);
        }
    } catch (error) {
        if (error.stdout) {
            process.stdout.write(error.stdout);
        }

        if (error.stderr) {
            process.stderr.write(error.stderr);
        }

        throw new Error("Publish failed");
    }
}

async function publishExtension(extension) {
    const env = hasServicePrincipalAuth()
        ? process.env
        : { ...process.env, VSCE_PAT: await getBrowserOAuthToken() };

    runVscePublish(extension, env);
}

function bumpVersions(extension, version) {
    const packageJson = readJson(extension.packageJsonPath);
    packageJson.version = version;
    writeJson(extension.packageJsonPath, packageJson);

    const lockPath = join(repoRoot, "package-lock.json");
    if (!existsSync(lockPath)) {
        return;
    }

    const packageLock = readJson(lockPath);
    const packageKeys = [extension.relativeDir, `node_modules/${extension.name}`];

    for (const key of packageKeys) {
        if (packageLock.packages?.[key]) {
            packageLock.packages[key].version = version;
        }
    }

    writeJson(lockPath, packageLock);
}

function releaseFiles(extension) {
    const files = [
        relative(repoRoot, extension.packageJsonPath),
        "package-lock.json",
        relative(repoRoot, extension.changelogPath),
    ];

    const readmePath = join(extension.dir, "README.md");
    if (existsSync(readmePath) && fileChanged(relative(repoRoot, readmePath))) {
        files.push(relative(repoRoot, readmePath));
    }

    return files.filter((file) => existsSync(join(repoRoot, file)));
}

function commitRelease(extension, version) {
    const files = releaseFiles(extension);
    run(`git add ${files.map((file) => `"${file}"`).join(" ")}`);

    let staged = false;
    try {
        execSync("git diff --cached --quiet", { cwd: repoRoot, stdio: "ignore" });
    } catch {
        staged = true;
    }

    if (!staged) {
        console.log("\nStamp already committed; skipping empty commit.");
        return;
    }

    run(`git commit -m "${extension.name} ${version}"`);
}

function stampVersion(extension, version) {
    bumpVersions(extension, version);
    commitRelease(extension, version);
    console.log(`\nStamped ${extension.name}@${version}.`);
}

function restoreWorkingTreeFiles(packageSnapshot, lockSnapshot, changelogSnapshot, extension) {
    if (packageSnapshot !== null) {
        writeText(extension.packageJsonPath, packageSnapshot);
    }

    if (lockSnapshot !== null) {
        writeText(join(repoRoot, "package-lock.json"), lockSnapshot);
    }

    if (changelogSnapshot !== null) {
        writeText(extension.changelogPath, changelogSnapshot);
    }
}

async function doPublish(extension, version) {
    run(`npm run verify -w ${extension.name}`);
    run(`npm run package:vsix -w ${extension.name}`);
    await publishExtension(extension);
    run("git push");
    console.log(`\nReleased ${extension.name}@${version} to the Marketplace`);
}

function printUsage() {
    console.error(
        "Usage: npm run release [--] [--package <name>] [<version|patch|minor|major>] [--publish]",
    );
}

async function main() {
    const { versionArg: initialVersionArg, publishOnly, packageName } = parseArgs(process.argv);

    if (!initialVersionArg && process.argv.includes("--publish")) {
        printUsage();
        process.exit(1);
    }

    const extension = await promptExtension(packageName);
    let versionArg = initialVersionArg;
    const currentVersion = readJson(extension.packageJsonPath).version;

    if (!versionArg) {
        versionArg = await promptVersionBump(currentVersion);
    }

    const version = nextVersion(currentVersion, versionArg);
    const isRetry = versionArg === version && compareSemver(version, currentVersion) === 0;

    if (!semverPattern.test(version)) {
        console.error(`Invalid semver: ${version}`);
        process.exit(1);
    }

    if (!isRetry && compareSemver(version, currentVersion) <= 0) {
        console.error(`Version ${version} must be greater than current version ${currentVersion}`);
        process.exit(1);
    }

    const takeSnapshots = !publishOnly && !isRetry;
    const packageSnapshot = takeSnapshots ? readText(extension.packageJsonPath) : null;
    const lockPath = join(repoRoot, "package-lock.json");
    const lockSnapshot = takeSnapshots && existsSync(lockPath) ? readText(lockPath) : null;
    const changelogSnapshot = takeSnapshots ? readText(extension.changelogPath) : null;
    let published = false;

    try {
        if (publishOnly && isRetry) {
            console.log(`Publishing ${extension.name}@${version}`);
            await doPublish(extension, version);
            published = true;
            return;
        }

        if (publishOnly && !isRetry) {
            console.log(`Preparing and publishing ${extension.name}@${version}`);
            prepareForStamp(extension, version);
            stampVersion(extension, version);
            await doPublish(extension, version);
            published = true;
            return;
        }

        if (isRetry) {
            console.log(`Version ${version} already stamped. Run with --publish to deploy.`);
            return;
        }

        console.log(`Preparing ${extension.name}@${version}`);
        prepareForStamp(extension, version);
        stampVersion(extension, version);

        const approved = await confirm(
            `Publish ${extension.name}@${version} to the VS Code Marketplace?`,
        );
        if (approved) {
            await doPublish(extension, version);
            published = true;
        } else {
            console.log(
                `Publish later: npm run release -- --package ${extension.name} ${version} --publish`,
            );
        }
    } catch (error) {
        if (!published && packageSnapshot !== null) {
            restoreWorkingTreeFiles(packageSnapshot, lockSnapshot, changelogSnapshot, extension);
            console.error(
                "\nRestored package.json, package-lock.json, and CHANGELOG.md to their pre-stamp versions.",
            );
        }

        console.error(`\nRelease failed: ${error.message}`);
        process.exit(1);
    }
}

void main();
