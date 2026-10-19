import type { AcpUiPromptImage } from "../../../src/protocol/extensionHostMessages";
import { maxPromptImages } from "../../../src/protocol/extensionHostMessages";

/** Largest image attachment accepted from the clipboard (10 MB base64-excluded). */
export const maxPasteImageBytes = 10 * 1024 * 1024;

export const maxPasteImageCount = maxPromptImages;

function dataTransferItems(dt: DataTransfer): DataTransferItem[] {
  const out: DataTransferItem[] = [];
  for (let i = 0; i < dt.items.length; i++) {
    const item = dt.items[i];
    if (item !== undefined) {
      out.push(item);
    }
  }
  return out;
}

function isImageFile(file: File): boolean {
  return file.size > 0 && file.type.startsWith("image/");
}

export function imageFilesFromClipboard(dt: DataTransfer): File[] {
  const out: File[] = [];
  for (const item of dataTransferItems(dt)) {
    if (item.kind !== "file") {
      continue;
    }
    const file = item.getAsFile();
    if (file !== null && isImageFile(file)) {
      out.push(file);
    }
  }
  if (out.length === 0) {
    for (const file of Array.from(dt.files)) {
      if (isImageFile(file)) {
        out.push(file);
      }
    }
  }
  return out.slice(0, maxPasteImageCount);
}

export function clipboardHasImages(dt: DataTransfer): boolean {
  return imageFilesFromClipboard(dt).length > 0;
}

/** Reads one image file into a base64 ACP image attachment. */
export function fileToPromptImage(file: File): Promise<AcpUiPromptImage | null> {
  if (!isImageFile(file) || file.size > maxPasteImageBytes) {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const dataUrl = typeof result === "string" ? result : "";
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      resolve(base64.length > 0 ? { data: base64, mimeType: file.type } : null);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error(`Failed to read ${file.name}`));
    };
    reader.readAsDataURL(file);
  });
}

/** Extracts pasted image attachments from clipboard data, up to the protocol limit. */
export async function collectImagesFromClipboard(
  dt: DataTransfer,
): Promise<AcpUiPromptImage[]> {
  const files = imageFilesFromClipboard(dt);
  const settled = await Promise.allSettled(files.map(fileToPromptImage));
  const out: AcpUiPromptImage[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value !== null) {
      out.push(result.value);
    }
  }
  return out.slice(0, maxPasteImageCount);
}

/** `data:` URL for rendering an image attachment thumbnail. */
export function promptImageSrc(image: AcpUiPromptImage): string {
  return `data:${image.mimeType};base64,${image.data}`;
}
