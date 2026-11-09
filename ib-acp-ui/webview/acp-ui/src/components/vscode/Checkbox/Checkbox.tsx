import type { ReactElement } from "react";
import "./Checkbox.css";

export type CheckboxProps = {
  id?: string;
  checked: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  className?: string;
  onChange: (checked: boolean) => void;
};

/**
 * Themed checkbox copied from the inline markdown task checkbox.
 */
export function Checkbox({
  id,
  checked,
  disabled = false,
  ariaLabel,
  title,
  className,
  onChange,
}: CheckboxProps): ReactElement {
  const rootClass = ["vs-checkbox", className ?? ""].filter((part) => part.length > 0).join(" ");

  return (
    <input
      id={id}
      type="checkbox"
      className={rootClass}
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      onChange={(event) => {
        onChange(event.target.checked);
      }}
    />
  );
}
