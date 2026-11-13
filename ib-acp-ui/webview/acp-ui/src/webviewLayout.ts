/** Width or height below this is a hidden webview, not a real layout. */
const minWebviewLayoutPx = 8;

export function webviewLayoutIsMeasurable(input: {
  visibilityState: DocumentVisibilityState;
  clientWidth: number;
  clientHeight: number;
}): boolean {
  if (input.visibilityState === "hidden") {
    return false;
  }
  return input.clientWidth >= minWebviewLayoutPx && input.clientHeight >= minWebviewLayoutPx;
}

export function webviewWidthIsMeasurable(input: {
  visibilityState: DocumentVisibilityState;
  clientWidth: number;
}): boolean {
  if (input.visibilityState === "hidden") {
    return false;
  }
  return input.clientWidth >= minWebviewLayoutPx;
}
