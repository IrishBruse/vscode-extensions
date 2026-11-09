import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("Checkbox", () => {
  it("copies the markdown task checkbox box and check mark", () => {
    const css = readFileSync(new URL("./Checkbox.css", import.meta.url), "utf8");
    expect(css).toContain(".vs-checkbox");
    expect(css).toContain("width: 14px");
    expect(css).toContain("height: 14px");
    expect(css).toContain(".vs-checkbox:checked::after");
    expect(css).toContain("border-width: 0 1.5px 1.5px 0");
    expect(css).toContain("transform: rotate(45deg)");
  });
});
