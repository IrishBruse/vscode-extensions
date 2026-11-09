import type { ReactElement, ReactNode } from "react";
import "./Button.css";

export type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  onClick?: () => void;
};

/**
 * Themed button copied from the ACP UI permission actions.
 */
export function Button({
  children,
  variant = "primary",
  disabled = false,
  type = "button",
  className,
  onClick,
}: ButtonProps): ReactElement {
  const rootClass = [
    "vs-button",
    variant === "secondary" ? "vs-button--secondary" : "",
    className ?? "",
  ]
    .filter((part) => part.length > 0)
    .join(" ");

  return (
    <button type={type} className={rootClass} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
