import {
  type ReactElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "./VsDropdown.css";

export type VsDropdownOption = {
  value: string;
  label: string;
  title?: string;
};

export type VsDropdownProps = {
  id?: string;
  ariaLabel: string;
  title?: string;
  value: string;
  options: VsDropdownOption[];
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  /** Stretch to the parent width. Composer fields stay content-sized. */
  block?: boolean;
  onChange: (value: string) => void;
};

function wrapIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
}

/**
 * Closed control plus a themed list, matching the VS Code settings dropdown.
 * The option list is drawn in the page so it does not use the native menu.
 */
export function VsDropdown({
  id,
  ariaLabel,
  title,
  value,
  options,
  disabled = false,
  busy = false,
  className,
  block = false,
  onChange,
}: VsDropdownProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];
  const label = selected?.label ?? value;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target) === true) {
        return;
      }
      if (menuRef.current?.contains(target) === true) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (trigger === null || menu === null) {
      return;
    }
    const place = (): void => {
      const rect = trigger.getBoundingClientRect();
      menu.style.minWidth = `${Math.round(rect.width)}px`;
      const menuRect = menu.getBoundingClientRect();
      const margin = 4;
      let left = rect.left;
      if (left + menuRect.width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - margin - menuRect.width);
      }
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openUp = menuRect.height > spaceBelow && spaceAbove > spaceBelow;
      menu.style.left = `${Math.round(Math.max(margin, left))}px`;
      menu.style.top = openUp
        ? `${Math.round(rect.top - menuRect.height - 2)}px`
        : `${Math.round(rect.bottom + 2)}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, options]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const row = menuRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    row?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openMenu = (): void => {
    if (disabled || options.length === 0) {
      return;
    }
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const pick = (next: string): void => {
    setOpen(false);
    triggerRef.current?.focus();
    if (next !== value) {
      onChange(next);
    }
  };

  const rootClass = ["vs-dropdown", block ? "vs-dropdown--block" : "", className ?? ""]
    .filter((part) => part.length > 0)
    .join(" ");

  const menu =
    open && options.length > 0
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            className="vs-dropdown-menu"
            role="listbox"
            aria-label={ariaLabel}
          >
            {options.map((option, index) => {
              const selectedRow = option.value === value;
              const active = index === activeIndex;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selectedRow}
                  data-active={active ? "true" : "false"}
                  title={option.title}
                  className={
                    active ? "vs-dropdown-option vs-dropdown-option--active" : "vs-dropdown-option"
                  }
                  onMouseEnter={() => {
                    setActiveIndex(index);
                  }}
                  onClick={() => {
                    pick(option.value);
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={rootClass}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="vs-dropdown-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-busy={busy || undefined}
        title={title ?? label}
        disabled={disabled}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          openMenu();
        }}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }
          if (event.key === "Escape") {
            if (open) {
              event.preventDefault();
              setOpen(false);
            }
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              openMenu();
              return;
            }
            const delta = event.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((current) => wrapIndex(current + delta, options.length));
            return;
          }
          if ((event.key === "Enter" || event.key === " ") && open) {
            event.preventDefault();
            const option = options[activeIndex];
            if (option !== undefined) {
              pick(option.value);
            }
          }
        }}
      >
        <span className="vs-dropdown-value">{label}</span>
        <svg className="vs-dropdown-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4.4 6.2 8 9.8l3.6-3.6-.7-.7L8 8.4 5.1 5.5z"
          />
        </svg>
      </button>
      {menu}
    </div>
  );
}
