import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createVscodePlugin } from "../../ib-utilities/lint/vscodeExtension.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

export default createVscodePlugin(packageJson, "vscode-markdown-inline", "ib-markdown-inline.");
