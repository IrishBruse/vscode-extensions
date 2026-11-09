import type { ReactElement } from "react";
import "./Input.css";

export type InputProps = {
  id?: string;
  value: string;
  description?: string;
  ariaLabel?: string;
  placeholder?: string;
  modified?: boolean;
  disabled?: boolean;
  type?: "text" | "number";
  className?: string;
  onChange: (value: string) => void;
};

/**
 * Settings-style text field: optional description, modified bar, and input box.
 */
export function Input({
  id,
  value,
  description,
  ariaLabel,
  placeholder,
  modified = false,
  disabled = false,
  type = "text",
  className,
  onChange,
}: InputProps): ReactElement {
  const rootClass = ["vs-input", className ?? ""].filter((part) => part.length > 0).join(" ");

  return (
    <label className={rootClass}>
      {modified ? <span className="vs-input-modified" aria-hidden="true" /> : null}
      <span className="vs-input-body">
        {description !== undefined && description.length > 0 ? (
          <span className="vs-input-description">{description}</span>
        ) : null}
        <input
          id={id}
          className="vs-input-control"
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel ?? description}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      </span>
    </label>
  );
}
