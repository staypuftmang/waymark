"use client";

import { useState, useEffect } from "react";

interface OneTimeTooltipProps {
  id: string;
  children: React.ReactNode;
}

export default function OneTimeTooltip({ id, children }: OneTimeTooltipProps) {
  const [dismissed, setDismissed] = useState(true); // default hidden until we check

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tooltip_" + id);
      setDismissed(stored === "true");
    } catch {
      // localStorage unavailable (incognito) — show the tooltip
      setDismissed(false);
    }
  }, [id]);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("tooltip_" + id, "true");
    } catch {
      // silently fail
    }
  };

  return (
    <div
      style={{
        background: "rgba(154,52,18,0.04)",
        border: "1px solid rgba(154,52,18,0.12)",
        borderRadius: 5,
        padding: "10px 14px",
        fontSize: 12,
        color: "var(--color-ink)",
        lineHeight: 1.5,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        marginTop: 8,
      }}
    >
      <div>{children}</div>
      <button
        onClick={dismiss}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-accent)",
          fontSize: 11,
          fontWeight: 600,
          fontFamily: "var(--font-body)",
          whiteSpace: "nowrap",
          padding: "4px 0",
        }}
      >
        Got it
      </button>
    </div>
  );
}
