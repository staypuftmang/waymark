"use client";

import type { CSSProperties, ReactNode } from "react";

interface PillProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Optional aria-label override when the pill content isn't readable text
   * (e.g. when content is a glyph or wraps an icon). */
  "aria-label"?: string;
  disabled?: boolean;
}

/**
 * Single pill-shaped category button. Used wherever the user picks one
 * option from a small set: Quick Create's Visual / Voice / Length, the
 * RewriteAll length popover, FeedbackWidget's bug/feature/question/other,
 * etc.
 *
 * Keep the geometry tight (4×10 padding, fontSize 11) so a row of five
 * fits comfortably below the helper text in narrow form columns.
 */
export default function Pill({
  selected,
  onClick,
  children,
  disabled = false,
  ...aria
}: PillProps) {
  const style: CSSProperties = {
    padding: "4px 10px",
    borderRadius: 3,
    border: selected
      ? "1.5px solid var(--color-accent)"
      : "1px solid var(--color-border)",
    background: selected ? "rgba(154,52,18,.06)" : "var(--color-card)",
    fontSize: 11,
    fontWeight: selected ? 700 : 400,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "var(--font-body)",
    color: "var(--color-ink)",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className="wm-chip"
      style={style}
      {...aria}
    >
      {children}
    </button>
  );
}
