import { useCallback, useRef, type ReactElement } from "react";
import "./Sash.css";

export type SashProps = {
  orientation?: "vertical" | "horizontal";
  className?: string;
  onDrag?: (deltaPx: number) => void;
  onDragEnd?: () => void;
};

/** Workbench-style draggable sash between two panels. */
export function Sash({
  orientation = "vertical",
  className,
  onDrag,
  onDragEnd,
}: SashProps): ReactElement {
  const activeRef = useRef(false);
  const lastRef = useRef(0);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!onDrag) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      activeRef.current = true;
      lastRef.current = orientation === "vertical" ? event.clientX : event.clientY;
      event.currentTarget.classList.add("vs-sash--active");
    },
    [onDrag, orientation],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!activeRef.current || !onDrag) {
        return;
      }
      const current = orientation === "vertical" ? event.clientX : event.clientY;
      const delta = current - lastRef.current;
      lastRef.current = current;
      onDrag(delta);
    },
    [onDrag, orientation],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!activeRef.current) {
        return;
      }
      activeRef.current = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
      event.currentTarget.classList.remove("vs-sash--active");
      onDragEnd?.();
    },
    [onDragEnd],
  );

  const rootClass = [
    "vs-sash",
    orientation === "vertical" ? "vs-sash--vertical" : "vs-sash--horizontal",
    className ?? "",
  ]
    .filter((part) => part.length > 0)
    .join(" ");

  return (
    <div
      className={rootClass}
      role="separator"
      aria-orientation={orientation}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}