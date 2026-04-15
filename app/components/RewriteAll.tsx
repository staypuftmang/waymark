"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";
import { Photo, WordStyleKey, VisualStyleKey } from "@/app/lib/types";
import { cleanJson } from "@/app/lib/constants";
import { aiCall } from "@/app/lib/ai";
import { batchRewritePrompt } from "@/app/lib/prompts";

interface RewriteAllProps {
  photos: Photo[];
  onUpdate: (id: number, field: string, value: string) => void;
  title: string;
  brief: string;
  wordStyle: WordStyleKey;
  visualStyle: VisualStyleKey;
  dateDisplay: string;
}

interface StagedResult {
  caption?: string;
  notes?: string;
  paragraph?: string;
}

export default function RewriteAll({ photos, onUpdate: up, title, brief, wordStyle: ws, visualStyle: vk, dateDisplay: dd }: RewriteAllProps) {
  const [loading, setLoading] = useState(false);
  const [staged, setStaged] = useState<Record<number, StagedResult> | null>(null);

  const run = async () => {
    setLoading(true);
    const eligibleCount = photos.filter((p) => p.caption || p.notes || p.aiCaption || p.aiNotes).length;
    track("ai_generated", { mode: "rewrite_all", photoCount: eligibleCount, wordStyle: ws, visualStyle: vk });
    const res: Record<number, StagedResult> = {};
    const previousOutputs: string[] = [];

    for (const p of photos) {
      const capText = p.aiCaption || p.caption;
      const notesText = p.aiNotes || p.notes;
      if (!capText && !notesText) continue;

      const prompt = batchRewritePrompt(ws, title, brief, dd, capText, notesText, previousOutputs);

      const raw = await aiCall(prompt);
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
    setStaged(res);
    setLoading(false);
  };

  const acceptAll = () => {
    if (!staged) return;
    for (const p of photos) {
      const s = staged[p.id];
      if (!s) continue;
      if (s.caption) up(p.id, "aiCaption", s.caption);
      if (s.notes) up(p.id, "aiNotes", s.notes);
      if (s.paragraph) up(p.id, "aiParagraph", s.paragraph);
    }
    setStaged(null);
  };

  const accept1 = (id: number) => {
    if (!staged) return;
    const s = staged[id];
    if (!s) return;
    if (s.caption) up(id, "aiCaption", s.caption);
    if (s.notes) up(id, "aiNotes", s.notes);
    if (s.paragraph) up(id, "aiParagraph", s.paragraph);
    setStaged((v) => {
      if (!v) return null;
      const n = { ...v };
      delete n[id];
      return Object.keys(n).length ? n : null;
    });
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

  const btnAccent: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    border: "none",
    borderRadius: 5,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "var(--font-body)",
    cursor: "pointer",
    background: "var(--color-accent)",
    color: "#fff",
  };

  const btnSecondary: React.CSSProperties = {
    ...btnAccent,
    background: "none",
    color: "var(--color-ink)",
    border: "1px solid var(--color-border)",
  };

  return (
    <>
      <button
        onClick={run}
        disabled={loading || !has || !!staged}
        style={{
          ...btnAccent,
          fontSize: 12,
          padding: "7px 14px",
          opacity: loading || !!staged ? 0.5 : 1,
          cursor: loading || !has || !!staged ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "\u2026 Generating" : "\u2726 Rewrite All"}
      </button>

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
                        <button
                          onClick={() => accept1(p.id)}
                          style={{ ...btnAccent, padding: "4px 14px", fontSize: 11 }}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => reject1(p.id)}
                          style={{ ...btnSecondary, padding: "4px 14px", fontSize: 11 }}
                        >
                          Reject
                        </button>
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
              <button onClick={() => setStaged(null)} style={btnSecondary}>
                Reject All
              </button>
              <button onClick={acceptAll} style={btnAccent}>
                &#x2726; Accept All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
