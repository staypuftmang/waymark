"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { Photo, LengthKey } from "@/app/lib/types";
import { cleanJson, LE, formatDate } from "@/app/lib/constants";
import { aiCall } from "@/app/lib/ai";
import { batchRewritePrompt } from "@/app/lib/prompts";
import { useUnloadGuard } from "@/app/lib/useUnloadGuard";
import { useJournal } from "@/app/context/JournalContext";
import { Button, Pill, PillGroup } from "./ui";

interface RewriteAllProps {
  /** Per-journal rewrite counter (used / 30). When >= 30 the parent
   * page disables the button entirely; we surface the soft warning
   * inline as the cap approaches. Comes from rateStatus which lives
   * at the page level, not in journal context. */
  rewritesUsed?: number;
  rewritesRemaining?: number;
}

interface StagedResult {
  caption?: string;
  notes?: string;
  paragraph?: string;
}

export default function RewriteAll({
  rewritesUsed, rewritesRemaining,
}: RewriteAllProps) {
  const { state, dispatch } = useJournal();
  const {
    photos,
    tripTitle: title,
    tripBrief: brief,
    ws,
    vk,
    len,
    startDate,
    endDate,
    currentJournalId: journalId,
  } = state;
  const dd = startDate
    ? endDate
      ? `${formatDate(startDate)} — ${formatDate(endDate)}`
      : formatDate(startDate)
    : "";
  const up = (id: number, field: string, value: string) =>
    dispatch({ type: "UPDATE_PHOTO_FIELD", id, field: field as keyof Photo, value });
  const onLengthChange = (v: LengthKey) => dispatch({ type: "SET_LEN", value: v });
  // After the user accepts staged rewrites, snapshot ws/len so the
  // regenerate-on-settings-change confirmation knows what produced the
  // current journal text.
  const onContentRegenerated = () => dispatch({ type: "SET_GEN_SNAPSHOT", ws, len });
  const [loading, setLoading] = useState(false);
  const [staged, setStaged] = useState<Record<number, StagedResult> | null>(null);
  const cancelRef = useRef(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  useUnloadGuard(loading);
  const [lengthMenuOpen, setLengthMenuOpen] = useState(false);
  const lengthWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lengthMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (lengthWrapRef.current && !lengthWrapRef.current.contains(e.target as Node)) {
        setLengthMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setLengthMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [lengthMenuOpen]);

  const cancel = () => {
    if (cancelBusy) return;
    cancelRef.current = true;
    setCancelBusy(true);
    setTimeout(() => setCancelBusy(false), 800);
  };

  const run = async () => {
    cancelRef.current = false;
    setLoading(true);
    const eligibleCount = photos.filter((p) => p.caption || p.notes || p.aiCaption || p.aiNotes).length;
    track("ai_generated", { mode: "rewrite_all", photoCount: eligibleCount, wordStyle: ws, visualStyle: vk });
    const res: Record<number, StagedResult> = {};
    const previousOutputs: string[] = [];

    for (const p of photos) {
      if (cancelRef.current) break;
      const capText = p.aiCaption || p.caption;
      const notesText = p.aiNotes || p.notes;
      if (!capText && !notesText) continue;

      const prompt = batchRewritePrompt(ws, title, brief, dd, capText, notesText, previousOutputs, len);

      const raw = await aiCall(prompt, p.src, { actionType: "rewrite_batch_photo", journalId });
      if (cancelRef.current) break;
      if (raw) {
        try {
          const parsed = JSON.parse(cleanJson(raw));
          res[p.id] = parsed;
          if (parsed.caption) previousOutputs.push(parsed.caption);
        } catch (e) {
          console.error(e);
        }
      }
    }
    cancelRef.current = false;
    // Surface whatever we collected (even partial) so the user can review it.
    // If nothing was collected (cancelled instantly), skip the staging modal.
    setStaged(Object.keys(res).length > 0 ? res : null);
    setLoading(false);
  };

  const acceptAll = () => {
    if (!staged) return;
    for (const p of photos) {
      const s = staged[p.id];
      if (!s) continue;
      if (s.caption) up(p.id, "aiCaption", s.caption);
      // Brief asks for empty notes — clear any prior pull quote.
      up(p.id, "aiNotes", s.notes ?? "");
      if (s.paragraph) up(p.id, "aiParagraph", s.paragraph);
    }
    setStaged(null);
    onContentRegenerated?.();
  };

  const accept1 = (id: number) => {
    if (!staged) return;
    const s = staged[id];
    if (!s) return;
    if (s.caption) up(id, "aiCaption", s.caption);
    up(id, "aiNotes", s.notes ?? "");
    if (s.paragraph) up(id, "aiParagraph", s.paragraph);
    setStaged((v) => {
      if (!v) return null;
      const n = { ...v };
      delete n[id];
      return Object.keys(n).length ? n : null;
    });
    onContentRegenerated?.();
  };

  const reject1 = (id: number) => {
    setStaged((v) => {
      if (!v) return null;
      const n = { ...v };
      delete n[id];
      return Object.keys(n).length ? n : null;
    });
  };

  const has = photos.some((p) => p.caption || p.notes || p.aiCaption || p.aiNotes);

  // Soft "X of 30 rewrites used" pill \u2014 only show once the user has used
  // more than 10. At 25+, escalate the color to the accent warning shade.
  const showRewriteCounter = typeof rewritesUsed === "number" && rewritesUsed > 10;
  const counterColor = (rewritesUsed ?? 0) >= 25 ? "var(--color-accent)" : "var(--color-stone)";

  return (
    <>
      <div className="inline-flex items-center" style={{ gap: 8, flexWrap: "wrap" }}>
        <div ref={lengthWrapRef} style={{ position: "relative", display: "inline-flex" }}>
          <Button
            size="sm"
            disabled={loading || !has || !!staged}
            onClick={() => { if (!loading && !staged) setLengthMenuOpen((v) => !v); }}
            aria-haspopup="menu"
            aria-expanded={lengthMenuOpen}
          >
            {loading ? "\u2026 Generating" : `\u2726 Rewrite All \u2022 ${LE[len].label}`}
          </Button>

          {lengthMenuOpen && (
            <div
              role="menu"
              className="bg-card border border-border"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                zIndex: 60,
                borderRadius: 5,
                padding: 12,
                minWidth: 220,
                boxShadow: "0 8px 30px rgba(0,0,0,.12)",
              }}
            >
              <div className="text-stone uppercase" style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>
                Length
              </div>
              <PillGroup marginTop={0}>
                {(["brief", "standard", "detailed"] as const).map((k) => (
                  <Pill
                    key={k}
                    selected={len === k}
                    onClick={() => {
                      onLengthChange(k);
                      track("length_selected", { value: k });
                    }}
                  >
                    {LE[k].label}
                  </Pill>
                ))}
              </PillGroup>
              <div style={{ marginTop: 10 }}>
                <Button
                  size="sm"
                  onClick={() => { setLengthMenuOpen(false); run(); }}
                  style={{ width: "100%" }}
                >
                  Rewrite at {LE[len].label}
                </Button>
              </div>
            </div>
          )}
        </div>
        {showRewriteCounter && (
          <span style={{ fontSize: 12, color: counterColor, fontFamily: "var(--font-body)" }}>
            {rewritesUsed} of 30 rewrites used
          </span>
        )}
        {loading && (
          <button
            onClick={cancel}
            disabled={cancelBusy}
            className="font-body cursor-pointer"
            style={{
              background: "transparent",
              color: "var(--color-ink)",
              border: "1px solid var(--color-ink)",
              borderRadius: 3,
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 500,
              cursor: cancelBusy ? "wait" : "pointer",
              opacity: cancelBusy ? 0.5 : 1,
            }}
          >
            Cancel generation
          </button>
        )}
      </div>

      {staged && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: "rgba(26,24,21,.6)" }}
        >
          <div
            className="bg-paper flex flex-col"
            style={{
              borderRadius: 5,
              maxWidth: 600,
              width: "100%",
              maxHeight: "80vh",
              boxShadow: "0 16px 48px rgba(0,0,0,.2)",
            }}
          >
            {/* Header */}
            <div
              className="flex justify-between items-center shrink-0"
              style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}
            >
              <div>
                <div className="font-title" style={{ fontSize: 20, fontWeight: 300 }}>
                  Review rewrites
                </div>
                <div className="text-stone mt-0.5" style={{ fontSize: 12 }}>
                  {Object.keys(staged).length} photos
                </div>
              </div>
              <button
                onClick={() => setStaged(null)}
                className="bg-transparent border-none cursor-pointer text-stone"
                style={{ fontSize: 16 }}
              >
                &#x2715;
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1" style={{ padding: "12px 20px" }}>
              {photos
                .filter((p) => staged[p.id])
                .map((p) => {
                  const s = staged[p.id];
                  return (
                    <div
                      key={p.id}
                      className="bg-card border border-border"
                      style={{ borderRadius: 5, padding: 12, marginBottom: 10 }}
                    >
                      <div className="flex gap-2 mb-2.5">
                        <img
                          src={p.src}
                          className="object-cover"
                          style={{ width: 40, height: 40, borderRadius: 3 }}
                          alt=""
                        />
                        <div className="text-stone self-center" style={{ fontSize: 11 }}>
                          {p.caption || p.notes}
                        </div>
                      </div>
                      {(["caption", "notes", "paragraph"] as const).map((f) =>
                        s[f] ? (
                          <div key={f} style={{ marginBottom: 6 }}>
                            <div
                              className="text-stone font-bold uppercase"
                              style={{ fontSize: 9, letterSpacing: 1, marginBottom: 2 }}
                            >
                              {f}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                background: "rgba(154,52,18,.03)",
                                padding: "6px 8px",
                                borderRadius: 3,
                                borderLeft: "2px solid var(--color-accent)",
                                lineHeight: 1.5,
                              }}
                            >
                              {s[f]}
                            </div>
                          </div>
                        ) : null
                      )}
                      <div className="flex gap-1.5 mt-2">
                        <Button size="sm" onClick={() => accept1(p.id)}>
                          Accept
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => reject1(p.id)}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Footer */}
            <div
              className="flex justify-between shrink-0"
              style={{ padding: "12px 20px", borderTop: "1px solid var(--color-border)" }}
            >
              <Button variant="secondary" onClick={() => setStaged(null)}>
                Reject All
              </Button>
              <Button onClick={acceptAll}>
                &#x2726; Accept All
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
