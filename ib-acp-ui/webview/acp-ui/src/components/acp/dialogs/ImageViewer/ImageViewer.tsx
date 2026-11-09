import { type ReactElement, useEffect } from "react";
import "./ImageViewer.css";

export type ImageViewerProps = {
  src: string;
  onClose: () => void;
};

/**
 * Fullscreen overlay for one image; click anywhere or press Escape to close.
 */
export function ImageViewer({ src, onClose }: ImageViewerProps): ReactElement {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);
  return (
    <div
      className="image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <img className="image-viewer-img" src={src} alt="Pasted image preview" />
    </div>
  );
}
