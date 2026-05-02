"use client";

import type { CSSProperties, ReactNode, MouseEventHandler, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: Variant;
  size?: Size;
  /** Optional left-side glyph (icon or single character). Spacing is handled
   * automatically — pass plain text and it will sit to the left of children. */
  leftSlot?: ReactNode;
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Defaults to "button" so a Button inside a form doesn't accidentally submit. */
  type?: "button" | "submit" | "reset";
}

const sizing: Record<Size, CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: 12, gap: 6, borderRadius: 4 },
  md: { padding: "10px 20px", fontSize: 13, gap: 8, borderRadius: 5 },
  lg: { padding: "12px 24px", fontSize: 14, gap: 10, borderRadius: 5 },
};

const variants: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--color-accent)",
    color: "var(--color-paper)",
    border: "1px solid var(--color-accent)",
  },
  secondary: {
    background: "transparent",
    color: "var(--color-ink)",
    border: "1px solid var(--color-border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-ink)",
    border: "1px solid transparent",
  },
};

/**
 * Shared button primitive. Replaces ad-hoc btnPrimary / btnSecondary /
 * btnAccent inline-style objects scattered across page.tsx, RewriteAll.tsx,
 * and others. Three variants cover ~95 % of buttons in the app:
 *
 * - primary  → accent bg (rust), used for confirms, "Generate", "Save", etc.
 * - secondary → outlined, used for cancels and back-paths.
 * - ghost    → transparent, used for low-emphasis chrome links.
 *
 * Disabled state dims to 0.5 opacity and switches the cursor; callers don't
 * need to handle that themselves.
 */
export default function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  leftSlot,
  children,
  type = "button",
  style,
  ...rest
}: ButtonProps) {
  const merged: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "opacity .15s ease",
    whiteSpace: "nowrap",
    ...sizing[size],
    ...variants[variant],
    ...style,
  };

  return (
    <button type={type} disabled={disabled} style={merged} {...rest}>
      {leftSlot != null && <span aria-hidden>{leftSlot}</span>}
      {children}
    </button>
  );
}
