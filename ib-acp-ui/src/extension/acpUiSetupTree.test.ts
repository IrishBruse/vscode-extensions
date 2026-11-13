import { describe, expect, it } from "vite-plus/test";
import {
    manualClientsAfterAdd,
    manualClientsAfterEdit,
    manualClientsAfterRemove,
    parseClientArgsInput,
} from "./acpUiSetupTree";

const manual = {
    name: "Local",
    command: "my-agent",
    args: ["--acp"],
    env: { TOKEN: "x" },
};

describe("manual client edits", () => {
    it("adds, edits, and removes settings clients", () => {
        const added = manualClientsAfterAdd([], manual);
        expect(added).toEqual([manual]);
        const replaced = manualClientsAfterAdd(added, { ...manual, command: "other" });
        expect(replaced).toEqual([{ ...manual, command: "other" }]);
        const edited = manualClientsAfterEdit(replaced, "Local", {
            command: "agent",
            args: ["--acp"],
        });
        expect(edited[0]).toMatchObject({
            name: "Local",
            command: "agent",
            args: ["--acp"],
            env: { TOKEN: "x" },
        });
        expect(manualClientsAfterRemove(edited, "Local")).toEqual([]);
        expect(parseClientArgsInput(" --acp  --foo ")).toEqual(["--acp", "--foo"]);
        expect(parseClientArgsInput("  ")).toEqual([]);
    });
});
