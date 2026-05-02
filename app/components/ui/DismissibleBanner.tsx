"use client";

import type { CSSProperties, ReactNode } from "react";

type Tone = "amber" | "stone";

interface DismissibleBannerProps {
  tone: Tone;
  onDismiss: () => void;
  children: ReactNode;
  /** Override outer margin if the parent already handles spacing. */
  style?: CSSProperties;
}

const tones: Record<Tone, CSSProperties> = {
  amber: {
    background: "rgba(196, 164, 90, 0.12)",
    border: "1px solid rgba(196, 164, 90, 0.4)",
    color: "#8B6914",
  },
  stone: {
    background: "transparent",
    border: "none",
    color: "var(--color-stone)",
  },
};

/**
 * One-line advisory tip with a dismiss X. Used wherever the app surfaces
 * a soft, optional warning the user can wave away — over-soft-cap photo
 * count, brief-vs-photos nudge, future tips. Replaces hand-rolled status
 * divs that duplicated the same flex + dismiss layout.
 *
 * Two tones map onto the existing visual treatments:
 *
 * - amber → tinted panel for headline tips ("Heads up: …")
 * - stone → quiet inline tip with no panel chrome
 */
export default function DismissibleBanner({
  tone,
  onDismiss,
  children,
  style,
}: DismissibleBannerProps) {
  const isPanel = tone === "amber";
  const merged: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    fontFamily: "var(--font-body)",
    fontSize: isPanel ? 13 : 12,
    lineHeight: 1.5,
    padding: isPanel ? "10px 12px" : 0,
    borderRadius: isPanel ? 4 : 0,
    opacity: tone === "stone" ? 0.85 : 1,
    ...tones[tone],
    ...style,
  };

  return (
    <div role="status" style={merged}>
      <span style={{ flex: 1 }}>{children}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: "inherit",
          padding: 2,
          fontSize: isPanel ? 14 : 12,
          lineHeight: 1,
          opacity: 0.6,
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  );
}
