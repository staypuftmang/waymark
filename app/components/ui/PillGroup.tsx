"use client";

import type { ReactNode } from "react";

interface PillGroupProps {
  children: ReactNode;
  /** Override the default 4 px gap. Useful in tight side-by-side layouts. */
  gap?: number;
  /** Override the default top margin. Set to 0 if rendering inside a
   * flex parent that already controls vertical spacing. */
  marginTop?: number;
}

/**
 * Flex-wrap row container for <Pill> children. Centralizes the
 * `flex gap-1 flex-wrap` + `marginTop: 6` boilerplate that every
 * pill-selector site repeats.
 */
export default function PillGroup({ children, gap = 4, marginTop = 6 }: PillGroupProps) {
  return (
    <div
      className="flex flex-wrap"
      style={{ gap, marginTop }}
    >
      {children}
    </div>
  );
}
