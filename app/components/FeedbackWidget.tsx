"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { useAuth } from "@/app/lib/AuthContext";
import { supabase } from "@/app/lib/supabase";

type Category = "bug" | "feature_request" | "question" | "other";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "bug", label: "Bug" },
  { key: "feature_request", label: "Feature Request" },
  { key: "question", label: "Question" },
  { key: "other", label: "Other" },
];

const OPEN_EVENT = "wm:open-feedback";

/**
 * Programmatic trigger — fired from the FAQ "Send us a message" link or
 * any other in-app spot. The widget listens for this and opens itself.
 */
export function openFeedback() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export default function FeedbackWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Listen for programmatic-open requests (e.g. the FAQ page CTA).
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setStatus("idle");
      track("feedback_widget_opened", { trigger: "external" });
    };
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset success timer on unmount.
  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  const launch = useCallback(() => {
    setOpen(true);
    setStatus("idle");
    track("feedback_widget_opened", { trigger: "fab" });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const reset = useCallback(() => {
    setCategory(null);
    setMessage("");
    setEmail("");
    setStatus("idle");
  }, []);

  const submit = useCallback(async () => {
    if (!category || !message.trim() || submitting) return;
    setSubmitting(true);
    setStatus("idle");
    try {
      const row = {
        user_id: user?.id ?? null,
        email: !user && email.trim() ? email.trim() : null,
        category,
        message: message.trim(),
        page_url: typeof window !== "undefined" ? window.location.href : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      };
      const { error } = await supabase.from("feedback").insert(row);
      if (error) throw error;
      track("feedback_submitted", { category });
      setStatus("success");
      successTimer.current = setTimeout(() => {
        setOpen(false);
        // Wipe the form a beat after the panel closes.
        setTimeout(reset, 200);
      }, 3000);
    } catch (err) {
      console.error("feedback submit failed:", err instanceof Error ? err.message : "unknown");
      track("feedback_error", { category });
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  }, [category, message, email, user, submitting, reset]);

  const canSubmit = !!category && message.trim().length > 0 && !submitting;

  return (
    <>
      {/* Floating button. Inset bottom positioning uses a CSS var so the
          journal preview's sticky bottom bar can push it up when needed. */}
      {!open && (
        <button
          onClick={launch}
          aria-label="Send feedback"
          className="font-body"
          style={{
            position: "fixed",
            right: 20,
            bottom: "calc(20px + var(--wm-fab-bottom-offset, 0px))",
            width: 48,
            height: 48,
            borderRadius: 24,
            background: "var(--color-paper)",
            color: "var(--color-ink)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,0,0,0.16)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)"; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[400] flex items-end sm:items-center justify-end sm:justify-end p-3 sm:p-5"
          style={{ background: "rgba(26,24,21,.35)" }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div
            ref={panelRef}
            className="bg-card"
            style={{
              width: "100%",
              maxWidth: 380,
              borderRadius: 8,
              padding: "20px 20px 18px",
              boxShadow: "0 24px 60px rgba(0,0,0,.22)",
              fontFamily: "var(--font-body)",
              position: "relative",
            }}
          >
            <button
              onClick={close}
              aria-label="Close"
              className="bg-transparent border-none cursor-pointer"
              style={{
                position: "absolute",
                top: 10,
                right: 12,
                fontSize: 20,
                lineHeight: 1,
                color: "var(--color-stone)",
                padding: 4,
              }}
            >
              ×
            </button>

            {status === "success" ? (
              <div className="text-center" style={{ padding: "20px 8px 8px" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    background: "var(--color-accent)",
                    color: "#fff",
                    margin: "0 auto 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                  aria-hidden
                >
                  ✓
                </div>
                <div className="font-title" style={{ fontSize: 18, color: "var(--color-ink)", marginBottom: 6 }}>
                  Thanks!
                </div>
                <div className="text-stone" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  We read every message.
                </div>
              </div>
            ) : (
              <>
                <div
                  className="font-title"
                  style={{ fontSize: 18, fontWeight: 400, color: "var(--color-ink)", marginBottom: 14 }}
                >
                  Send feedback
                </div>

                <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 14 }}>
                  {CATEGORIES.map(({ key, label }) => {
                    const selected = category === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCategory(key)}
                        className="cursor-pointer font-body"
                        style={{
                          padding: "5px 11px",
                          borderRadius: 999,
                          border: selected ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
                          background: selected ? "var(--color-accent)" : "transparent",
                          color: selected ? "#fff" : "var(--color-ink)",
                          fontSize: 12,
                          fontWeight: selected ? 600 : 500,
                          transition: "background 0.15s, color 0.15s, border-color 0.15s",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--color-border)",
                    borderRadius: 5,
                    fontSize: 13,
                    fontFamily: "var(--font-body)",
                    background: "var(--color-card)",
                    color: "var(--color-ink)",
                    outline: "none",
                    resize: "vertical",
                    minHeight: 90,
                    lineHeight: 1.5,
                    marginBottom: 10,
                  }}
                />

                {!user && (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email (optional — for follow-up)"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid var(--color-border)",
                      borderRadius: 5,
                      fontSize: 13,
                      fontFamily: "var(--font-body)",
                      background: "var(--color-card)",
                      color: "var(--color-ink)",
                      outline: "none",
                      marginBottom: 12,
                    }}
                  />
                )}

                {status === "error" && (
                  <div
                    className="text-center"
                    style={{
                      fontSize: 12,
                      color: "var(--color-accent)",
                      marginBottom: 10,
                      padding: "8px 10px",
                      background: "rgba(196,85,58,0.08)",
                      borderRadius: 4,
                    }}
                  >
                    Something went wrong — try again.
                  </div>
                )}

                <div className="flex justify-end" style={{ gap: 8 }}>
                  {status === "error" && (
                    <button
                      onClick={submit}
                      disabled={!canSubmit}
                      className="font-body cursor-pointer"
                      style={{
                        padding: "8px 14px",
                        border: "1px solid var(--color-border)",
                        borderRadius: 4,
                        background: "transparent",
                        color: "var(--color-ink)",
                        fontSize: 12,
                        fontWeight: 500,
                        opacity: canSubmit ? 1 : 0.5,
                      }}
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={submit}
                    disabled={!canSubmit}
                    className="font-body border-none"
                    style={{
                      padding: "9px 18px",
                      borderRadius: 4,
                      background: "var(--color-ink)",
                      color: "var(--color-paper)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: canSubmit ? "pointer" : "not-allowed",
                      opacity: canSubmit ? 1 : 0.45,
                    }}
                  >
                    {submitting ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
