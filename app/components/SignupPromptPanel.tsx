"use client";

import { useEffect, useState } from "react";

interface SignupPromptPanelProps {
  open: boolean;
  onSignUp: () => void;
  onDismiss: () => void;
}

/**
 * Slide-up panel from the bottom of the preview. Non-blocking — the
 * journal preview stays fully visible above it. Sized to cap at ~40vh
 * on mobile so it never dominates the screen.
 */
export default function SignupPromptPanel({ open, onSignUp, onDismiss }: SignupPromptPanelProps) {
  const [mounted, setMounted] = useState(false);
  // Toggle a one-frame delay so the slide-up animation actually plays
  // instead of snapping to the open position on first render.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setMounted(true), 16);
      return () => clearTimeout(t);
    }
    setMounted(false);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Save your journal"
      className="fixed bottom-0 left-0 right-0 z-[250]"
      style={{
        pointerEvents: "none",
      }}
    >
      <div
        className="bg-card font-body"
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "24px 24px calc(24px + env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--color-border)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
          transform: mounted ? "translateY(0)" : "translateY(100%)",
          transition: "transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          maxHeight: "40vh",
          overflowY: "auto",
          pointerEvents: "auto",
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
        }}
      >
        <div
          className="font-title"
          style={{ fontSize: 22, fontWeight: 300, color: "var(--color-ink)", marginBottom: 8, lineHeight: 1.25 }}
        >
          Your journal is ready.
        </div>
        <p className="text-stone" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
          Save it to your account so you can come back to it anytime.
        </p>
        <button
          onClick={onSignUp}
          className="border-none cursor-pointer font-body"
          style={{
            width: "100%",
            minHeight: 44,
            padding: "12px 20px",
            borderRadius: 5,
            fontSize: 14,
            fontWeight: 600,
            background: "var(--color-accent)",
            color: "#fff",
          }}
        >
          Sign up free {"\u2014"} save this journal
        </button>
        <div className="text-center" style={{ marginTop: 12 }}>
          <button
            onClick={onDismiss}
            className="bg-transparent border-none cursor-pointer text-stone font-body"
            style={{ fontSize: 13, padding: "8px 4px" }}
          >
            or continue without saving
          </button>
        </div>
      </div>
    </div>
  );
}
