"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const ATTACHMENTS_BUCKET = "Feedback-Attachments";
const MAX_ATTACHMENTS = 2;
const MAX_BYTES = 5 * 1024 * 1024;

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
}

/**
 * Programmatic trigger — fired from the FAQ "Send us a message" link or
 * any other in-app spot. The widget listens for this and opens itself.
 */
export function openFeedback() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.maxTouchPoints > 0 && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
}

function uniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeExt(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "jpg";
  return name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toLowerCase() || "jpg";
}

export default function FeedbackWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error" | "partial">("idle");
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobile = useMemo(() => isMobileBrowser(), []);

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

  // Revoke blob URLs and clear timers on unmount.
  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
      attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    };
    // We only want this on unmount; per-attachment cleanup happens on remove.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const launch = useCallback(() => {
    setOpen(true);
    setStatus("idle");
    track("feedback_widget_opened", { trigger: "fab" });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const resetForm = useCallback(() => {
    setCategory(null);
    setMessage("");
    setEmail("");
    setStatus("idle");
    setAttachError(null);
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      return [];
    });
  }, []);

  const onPickFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachError(null);
    const incoming = Array.from(files);
    const errors: string[] = [];
    const accepted: PendingAttachment[] = [];

    setAttachments((current) => {
      const slotsLeft = Math.max(0, MAX_ATTACHMENTS - current.length);
      if (slotsLeft === 0) {
        errors.push(`Max ${MAX_ATTACHMENTS} screenshots`);
      }
      const room = incoming.slice(0, slotsLeft);
      const dropped = incoming.length - room.length;
      if (dropped > 0) errors.push(`${dropped} extra dropped (${MAX_ATTACHMENTS} max)`);

      for (const f of room) {
        if (!f.type.startsWith("image/")) {
          errors.push(`${f.name} skipped (not an image)`);
          continue;
        }
        if (f.size > MAX_BYTES) {
          errors.push(`${f.name} skipped (over 5 MB)`);
          continue;
        }
        accepted.push({ id: uniqueId(), file: f, previewUrl: URL.createObjectURL(f) });
      }

      if (errors.length > 0) setAttachError(errors.join(" · "));
      return [...current, ...accepted];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  /**
   * Upload all pending attachments. Returns the public URLs that succeeded
   * and a count of failures so the caller can decide to surface a partial
   * success message.
   */
  const uploadAttachments = useCallback(async (): Promise<{ urls: string[]; failed: number }> => {
    if (attachments.length === 0) return { urls: [], failed: 0 };
    const urls: string[] = [];
    let failed = 0;
    for (const a of attachments) {
      try {
        const path = `${user?.id ?? "anon"}/${uniqueId()}.${safeExt(a.file.name)}`;
        const { error } = await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .upload(path, a.file, {
            contentType: a.file.type || "image/jpeg",
            upsert: false,
          });
        if (error) throw error;
        const { data } = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path);
        if (data?.publicUrl) urls.push(data.publicUrl);
        else failed += 1;
      } catch (err) {
        console.error("attachment upload failed:", err instanceof Error ? err.message : "unknown");
        failed += 1;
      }
    }
    return { urls, failed };
  }, [attachments, user]);

  const submit = useCallback(async () => {
    if (!category || !message.trim() || submitting) return;
    setSubmitting(true);
    setStatus("idle");
    try {
      const { urls, failed } = await uploadAttachments();
      const row = {
        user_id: user?.id ?? null,
        email: !user && email.trim() ? email.trim() : null,
        category,
        message: message.trim(),
        page_url: typeof window !== "undefined" ? window.location.href : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        attachments: urls.length > 0 ? urls : null,
      };
      const { error } = await supabase.from("feedback").insert(row);
      if (error) throw error;
      track("feedback_submitted", { category, attachmentCount: urls.length });
      const partial = failed > 0;
      setStatus(partial ? "partial" : "success");
      successTimer.current = setTimeout(() => {
        setOpen(false);
        setTimeout(resetForm, 200);
      }, partial ? 4500 : 3000);
    } catch (err) {
      console.error("feedback submit failed:", err instanceof Error ? err.message : "unknown");
      track("feedback_error", { category });
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  }, [category, message, email, user, submitting, uploadAttachments, resetForm]);

  const canSubmit = !!category && message.trim().length > 0 && !submitting;

  const goToFaq = useCallback(() => {
    setOpen(false);
    if (typeof window !== "undefined") window.location.assign("/help");
  }, []);

  return (
    <>
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

            {(status === "success" || status === "partial") ? (
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
                {status === "partial" && (
                  <div className="text-stone" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
                    Feedback sent but screenshots failed to attach.
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={goToFaq}
                  type="button"
                  className="bg-transparent border-none cursor-pointer font-body"
                  style={{
                    fontSize: 13,
                    color: "var(--color-stone)",
                    padding: 0,
                    marginBottom: 10,
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-ink)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-stone)"; }}
                >
                  View FAQ →
                </button>

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
                    marginBottom: 8,
                  }}
                />

                {/* Hidden inputs the buttons trigger. Camera input only on mobile. */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
                  style={{ display: "none" }}
                />
                {isMobile && (
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
                    style={{ display: "none" }}
                  />
                )}

                <div className="flex items-center" style={{ gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={attachments.length >= MAX_ATTACHMENTS}
                    className="bg-transparent border-none cursor-pointer font-body"
                    style={{
                      fontSize: 13,
                      color: "var(--color-stone)",
                      padding: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: attachments.length >= MAX_ATTACHMENTS ? 0.5 : 1,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    Attach screenshot
                  </button>

                  {isMobile && (
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={attachments.length >= MAX_ATTACHMENTS}
                      className="bg-transparent border-none cursor-pointer font-body"
                      style={{
                        fontSize: 13,
                        color: "var(--color-stone)",
                        padding: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        opacity: attachments.length >= MAX_ATTACHMENTS ? 0.5 : 1,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      Take screenshot
                    </button>
                  )}
                </div>

                {attachError && (
                  <div className="text-stone" style={{ fontSize: 11, marginBottom: 8 }}>
                    {attachError}
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="flex" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    {attachments.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          position: "relative",
                          width: 56,
                          height: 56,
                          borderRadius: 4,
                          overflow: "hidden",
                          border: "1px solid var(--color-border)",
                          background: "var(--color-paper)",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.previewUrl}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          aria-label="Remove attachment"
                          className="border-none cursor-pointer"
                          style={{
                            position: "absolute",
                            top: 2,
                            right: 2,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            background: "rgba(26,24,21,0.78)",
                            color: "#fff",
                            fontSize: 12,
                            lineHeight: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

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
