import { describe, expect, it } from "vite-plus/test";
import type { AcpUiPromptImage } from "../../../src/protocol/extensionHostMessages";
import {
  clipboardHasImages,
  imageFilesFromClipboard,
  promptImageSrc,
} from "./pastedImages";

function fakeFile(name: string, type: string, size = 10): File {
  return { name, type, size } as unknown as File;
}

function fakeDataTransfer(
  items: Array<{ kind: string; file?: File }>,
  files: File[] = [],
): DataTransfer {
  return {
    types: items.length > 0 || files.length > 0 ? ["Files"] : [],
    items: {
      length: items.length,
      ...Object.fromEntries(
        items.map((item, index) => [index, { kind: item.kind, getAsFile: () => item.file ?? null }]),
      ),
    },
    files,
  } as unknown as DataTransfer;
}

describe("clipboardHasImages", () => {
  it("is true for clipboard image file items", () => {
    const dt = fakeDataTransfer([{ kind: "file", file: fakeFile("a.png", "image/png") }]);
    expect(clipboardHasImages(dt)).toBe(true);
  });

  it("is false for text-only clips", () => {
    const dt = fakeDataTransfer([{ kind: "string" }]);
    expect(clipboardHasImages(dt)).toBe(false);
  });

  it("is false for non-image files", () => {
    const dt = fakeDataTransfer([{ kind: "file", file: fakeFile("a.txt", "text/plain") }]);
    expect(clipboardHasImages(dt)).toBe(false);
  });
});

describe("imageFilesFromClipboard", () => {
  it("collects image items in order", () => {
    const dt = fakeDataTransfer([
      { kind: "file", file: fakeFile("a.png", "image/png") },
      { kind: "string" },
      { kind: "file", file: fakeFile("b.jpg", "image/jpeg") },
    ]);
    expect(
      imageFilesFromClipboard(dt).map((f) => (f as { name: string }).name),
    ).toEqual(["a.png", "b.jpg"]);
  });

  it("falls back to dt.files when items expose nothing", () => {
    const dt = fakeDataTransfer([], [fakeFile("a.png", "image/png")]);
    expect(imageFilesFromClipboard(dt).length).toBe(1);
  });

  it("caps the number of attachments", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      kind: "file",
      file: fakeFile(`a${i}.png`, "image/png"),
    }));
    expect(imageFilesFromClipboard(fakeDataTransfer(items)).length).toBe(8);
  });
});

describe("promptImageSrc", () => {
  it("builds a data URL from base64 data", () => {
    const image: AcpUiPromptImage = { data: "QUJD", mimeType: "image/png" };
    expect(promptImageSrc(image)).toBe("data:image/png;base64,QUJD");
  });
});
