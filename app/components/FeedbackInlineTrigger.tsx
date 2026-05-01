"use client";

import { openFeedback } from "./feedbackBus";

/**
 * Inline trigger button that opens the global FeedbackWidget. Used on the
 * /help page's "Still have questions?" CTA so the same panel UX powers
 * the FAQ overflow path.
 */
export default function FeedbackInlineTrigger({ label = "Send us a message" }: { label?: string }) {
  return (
    <button
      onClick={openFeedback}
      type="button"
      className="font-body cursor-pointer border-none"
      style={{
        background: "var(--color-ink)",
        color: "var(--color-paper)",
        padding: "11px 22px",
        borderRadius: 5,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}
