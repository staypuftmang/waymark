"use client";

import type { ReactNode } from "react";
import Button from "./Button";

interface ConfirmModalProps {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Visual emphasis on the confirm button. `primary` for routine actions
   * ("Resume", "Regenerate"); `danger` for destructive ones ("Discard",
   * "Delete"). Both render in accent today — the prop lets us redesign
   * danger styling later without churning every caller. */
  variant?: "primary" | "danger";
  /** Optional extra content rendered between the body and the buttons.
   * Use sparingly — only when a confirmation needs a small input or list. */
  extra?: ReactNode;
}

/**
 * Centered confirm/cancel modal on a darkened overlay. Replaces the
 * five+ ad-hoc modal blocks that used to live in page.tsx (resume,
 * discard, regen, brief replace, delete journal). Render conditionally
 * — when this is in the tree, the modal is shown.
 *
 *     {wantsConfirm && (
 *       <ConfirmModal
 *         title="Discard journal?"
 *         body="This will discard your current journal. Are you sure?"
 *         confirmLabel="Discard"
 *         cancelLabel="Cancel"
 *         variant="danger"
 *         onConfirm={() => { discard(); setWantsConfirm(false); }}
 *         onCancel={() => setWantsConfirm(false)}
 *       />
 *     )}
 */
export default function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = "primary",
  extra,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: "rgba(26,24,21,.6)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="bg-card"
        style={{
          borderRadius: 5,
          padding: "28px 24px",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 16px 48px rgba(0,0,0,.2)",
          textAlign: "center",
        }}
      >
        <div
          id="confirm-modal-title"
          className="font-title"
          style={{ fontSize: 20, fontWeight: 300, color: "var(--color-ink)", marginBottom: 8 }}
        >
          {title}
        </div>
        {body && (
          <div
            className="text-stone"
            style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}
          >
            {body}
          </div>
        )}
        {extra}
        <div className="flex gap-3 justify-center flex-wrap">
          <Button variant="secondary" size="md" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm}>
            {variant === "danger" ? confirmLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
