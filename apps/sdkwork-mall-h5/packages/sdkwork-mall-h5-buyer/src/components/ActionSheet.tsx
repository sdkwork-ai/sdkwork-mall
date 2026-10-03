import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";

export interface SdkworkMallH5ActionSheetOption {
  label: string;
  value: string;
}

/**
 * Bottom action-sheet single-choice picker — the touch-first replacement for
 * the desktop-style native `<select>` dropdown (APP_MOBILE_REACT_UI_SPEC §5).
 */
export function SdkworkMallH5ActionSheet({
  onClose,
  onSelect,
  open,
  options,
  title,
  value,
}: {
  onClose: () => void;
  onSelect: (value: string) => void;
  open: boolean;
  options: readonly SdkworkMallH5ActionSheetOption[];
  title: string;
  value: string;
}) {
  if (!open) {
    return null;
  }
  return (
    <div
      className="sdk-h5-actionsheet-mask"
      onClick={onClose}
      onKeyDown={() => {}}
      role="presentation"
    >
      <div
        aria-label={title}
        className="sdk-h5-actionsheet"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={() => {}}
        role="dialog"
      >
        <header className="sdk-h5-actionsheet-head">
          <strong>{title}</strong>
          <button aria-label="关闭" onClick={onClose} type="button">关闭</button>
        </header>
        {options.map((option) => (
          <button
            className={
              option.value === value
                ? "sdk-h5-actionsheet-row sdk-h5-actionsheet-row-active"
                : "sdk-h5-actionsheet-row"
            }
            key={option.value}
            onClick={() => {
              onSelect(option.value);
              onClose();
            }}
            type="button"
          >
            <span>{option.label}</span>
            {option.value === value ? <Check aria-hidden="true" size={16} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Generic navigation cell: label left, current value and chevron right;
 * the whole row is a single tap target (navigate-to-select pattern).
 */
export function SdkworkMallH5Cell({
  label,
  onClick,
  value,
}: {
  label: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <button className="sdk-h5-cell" onClick={onClick} type="button">
      <span className="sdk-h5-cell-label">{label}</span>
      <span
        className={
          value
            ? "sdk-h5-cell-value"
            : "sdk-h5-cell-value sdk-h5-cell-placeholder"
        }
      >
        {value || "请选择"}
      </span>
      <ChevronRight aria-hidden="true" className="sdk-h5-cell-chevron" size={14} />
    </button>
  );
}

/**
 * Picker cell (cell navigation form): label on the left, current value and a
 * chevron on the right; tapping opens the bottom action-sheet picker. Cells
 * stack into a full-bleed group card.
 */
export function SdkworkMallH5SelectCell({
  label,
  onChange,
  options,
  placeholder = "请选择",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly SdkworkMallH5ActionSheetOption[];
  placeholder?: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <>
      <button
        className="sdk-h5-cell"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="sdk-h5-cell-label">{label}</span>
        <span
          className={
            current
              ? "sdk-h5-cell-value"
              : "sdk-h5-cell-value sdk-h5-cell-placeholder"
          }
        >
          {current?.label ?? placeholder}
        </span>
        <ChevronRight aria-hidden="true" className="sdk-h5-cell-chevron" size={14} />
      </button>
      <SdkworkMallH5ActionSheet
        onClose={() => setOpen(false)}
        onSelect={onChange}
        open={open}
        options={options}
        title={label}
        value={value}
      />
    </>
  );
}
