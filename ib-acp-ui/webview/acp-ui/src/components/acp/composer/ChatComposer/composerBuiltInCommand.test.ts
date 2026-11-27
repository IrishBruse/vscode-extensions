import { describe, expect, it } from "vite-plus/test";
import { builtInSlashCommand } from "./composerBuiltInCommand";

describe("builtInSlashCommand", () => {
  it("treats a trailing space on /clear as clear", () => {
    expect(builtInSlashCommand("/clear ")).toBe("clear");
    expect(builtInSlashCommand("  /new")).toBe("new");
  });

  it("leaves a normal message alone", () => {
    expect(builtInSlashCommand("please /clear the file")).toBeUndefined();
  });
});
