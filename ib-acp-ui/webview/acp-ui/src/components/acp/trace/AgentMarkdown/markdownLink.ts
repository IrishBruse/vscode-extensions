import { filesystemPathFromFileUri } from "../../../../../../../src/platform/fileUriPath";

/** Filesystem path for a markdown link that should open in the editor. */
export function markdownFilePath(href: string): string | undefined {
  const fromFileUri = filesystemPathFromFileUri(href);
  if (fromFileUri !== undefined) {
    return fromFileUri;
  }
  const trimmed = href.trim();
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("~/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return trimmed;
  }
  return undefined;
}

/** `http` or `https` URL for a markdown link that should open outside the chat. */
export function markdownExternalUrl(href: string): string | undefined {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}
