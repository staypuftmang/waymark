"use client";

import { useState, useEffect, useRef } from "react";
import { Photo, WordStyleKey } from "@/app/lib/types";
import { aiCall } from "@/app/lib/ai";
import { rewriteCaptionPrompt, rewriteNotesPrompt, generateParagraphPrompt } from "@/app/lib/prompts";
import AiButton from "./AiButton";
import AiSuggestion from "./AiSuggestion";
import HelperText from "./HelperText";

interface PhotoCardProps {
  photo: Photo;
  index: number;
  total: number;
  onUpdate: (id: number, field: string, value: string) => void;
  onRemove: (id: number) => void;
  title: string;
  brief: string;
  wordStyle: WordStyleKey;
  dateDisplay: string;
  isCover: boolean;
  onToggleCover: (id: number) => void;
  dragHandleProps?: Record<string, unknown>;
}

export default function PhotoCard({
  photo: p,
  index: idx,
  total,
  onUpdate: up,
  onRemove: rm,
  title,
  brief,
  wordStyle: ws,
  dateDisplay: dd,
  isCover,
  onToggleCover,
  dragHandleProps,
}: PhotoCardProps) {
  const [loadingCaption, setLC] = useState(false);
  const [loadingNotes, setLN] = useState(false);
  const [loadingParagraph, setLP] = useState(false);
  const [showParagraph, setSP] = useState(!!p.paragraph || !!p.aiParagraph);

  const notesRef = useRef<HTMLTextAreaElement>(null);
  const paraRef = useRef<HTMLTextAreaElement>(null);
  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => { autosize(notesRef.current); }, [p.notes]);
  useEffect(() => { autosize(paraRef.current); }, [p.paragraph, showParagraph]);

  const rewrite = async (field: string, aiField: string, setLoading: (v: boolean) => void) => {
    const raw = (p[aiField as keyof Photo] as string) || (p[field as keyof Photo] as string);
    if (!raw) return;
    setLoading(true);
    const prompt = field === "caption"
      ? rewriteCaptionPrompt(ws, title, brief, raw)
      : rewriteNotesPrompt(ws, title, brief, raw);
    const t = await aiCall(prompt, p.src);
    if (t) up(p.id, aiField, t);
    setLoading(false);
  };

  const generateParagraph = async () => {
    setLP(true);
    const capText = p.aiCaption || p.caption;
    const notesText = p.aiNotes || p.notes;
    const t = await aiCall(generateParagraphPrompt(ws, title, brief, capText, notesText), p.src);
    if (t) {
      up(p.id, "aiParagraph", t);
      setSP(true);
    }
    setLP(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minWidth: 0,
    padding: "11px 14px",
    border: "1px solid var(--color-border)",
    borderRadius: 5,
    fontSize: 14,
    fontFamily: "var(--font-body)",
    background: "var(--color-card)",
    outline: "none",
    color: "var(--color-ink)",
    flex: 1,
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    resize: "none",
    minHeight: 44,
    lineHeight: 1.5,
    overflow: "hidden",
  };

  const iconBtn: React.CSSProperties = {
    width: 22,
    height: 22,
    border: "none",
    borderRadius: 3,
    background: "var(--color-paper)",
    color: "var(--color-stone)",
    cursor: "pointer",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div className="wm-photocard-card bg-card border border-border" style={{ borderRadius: 5, padding: 12 }}>
      <div className="wm-photocard-row flex gap-2.5 items-start">
        {/* Drag handle — only the handle is draggable; inputs stay usable */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="wm-drag-handle wm-photocard-drag flex items-center justify-center shrink-0"
            style={{
              width: 24,
              height: 44,
              cursor: "grab",
              color: "var(--color-warm)",
              opacity: 0.4,
              touchAction: "none",
              userSelect: "none",
              alignSelf: "center",
            }}
            aria-label={`Drag to reorder photo ${idx + 1} of ${total}`}
            role="button"
            tabIndex={0}
          >
            <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true">
              <circle cx="4" cy="4" r="1.6" />
              <circle cx="10" cy="4" r="1.6" />
              <circle cx="4" cy="10" r="1.6" />
              <circle cx="10" cy="10" r="1.6" />
              <circle cx="4" cy="16" r="1.6" />
              <circle cx="10" cy="16" r="1.6" />
            </svg>
          </div>
        )}

        <div className="wm-photocard-thumb flex flex-col items-center gap-1 shrink-0">
          <img
            src={p.src}
            className="object-cover"
            style={{
              width: 80,
              height: 80,
              borderRadius: 3,
              border: isCover ? "2px solid #C4A45A" : "2px solid transparent",
            }}
            alt=""
          />
          <button
            style={{ ...iconBtn, color: "var(--color-accent)" }}
            onClick={() => rm(p.id)}
            aria-label="Remove photo"
          >
            &#x00D7;
          </button>
          <button
            onClick={() => onToggleCover(p.id)}
            className="wm-cover-link cursor-pointer font-body bg-transparent p-0"
            style={{
              fontSize: isCover ? 10 : 12,
              fontWeight: isCover ? 600 : 500,
              border: "none",
              color: "var(--color-stone)",
              letterSpacing: isCover ? 1.2 : 0,
              textTransform: isCover ? "uppercase" : "none",
              whiteSpace: "nowrap",
            }}
            aria-pressed={isCover}
          >
            {isCover ? "Cover \u2713" : "Set as cover"}
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-1">
          <div className="wm-field-row flex gap-1 items-center">
            <input
              placeholder="A short label for this photo..."
              value={p.caption}
              onChange={(e) => up(p.id, "caption", e.target.value)}
              style={{ ...inputStyle, fontSize: 13 }}
            />
            {p.caption && (
              <AiButton onClick={() => rewrite("caption", "aiCaption", setLC)} loading={loadingCaption} small />
            )}
          </div>
          {idx === 0 && <HelperText>Captions appear as small labels under your photos in the journal.</HelperText>}
          <AiSuggestion
            text={p.aiCaption}
            onClear={() => up(p.id, "aiCaption", "")}
            onAccept={() => {
              up(p.id, "caption", p.aiCaption);
              up(p.id, "aiCaption", "");
            }}
          />

          <div className="wm-field-row flex gap-1 items-start">
            <textarea
              ref={notesRef}
              placeholder="What's the story behind this moment?"
              value={p.notes}
              onChange={(e) => up(p.id, "notes", e.target.value)}
              onInput={(e) => autosize(e.currentTarget)}
              rows={2}
              style={textareaStyle}
            />
            {p.notes && (
              <AiButton onClick={() => rewrite("notes", "aiNotes", setLN)} loading={loadingNotes} small />
            )}
          </div>
          {idx === 0 && <HelperText>Notes become the main readable text under each photo. The more you write, the better the AI can help.</HelperText>}
          <AiSuggestion
            text={p.aiNotes}
            onClear={() => up(p.id, "aiNotes", "")}
            onAccept={() => {
              up(p.id, "notes", p.aiNotes);
              up(p.id, "aiNotes", "");
            }}
          />

          <div className="flex gap-1.5 items-center mt-0.5">
            <button
              onClick={() => setSP(!showParagraph)}
              className="bg-transparent border-none text-accent font-semibold font-body cursor-pointer p-0"
              style={{ fontSize: 11 }}
            >
              {showParagraph ? "Hide paragraph \u25B4" : "+ Paragraph \u25BE"}
            </button>
            {(p.caption || p.notes) && (
              <AiButton onClick={generateParagraph} loading={loadingParagraph} label="Generate" small />
            )}
          </div>

          {showParagraph && (
            <div className="mt-1">
              <textarea
                ref={paraRef}
                placeholder="Full paragraph..."
                value={p.paragraph || ""}
                onChange={(e) => up(p.id, "paragraph", e.target.value)}
                onInput={(e) => autosize(e.currentTarget)}
                rows={4}
                style={{ ...textareaStyle, minHeight: 90, lineHeight: 1.6 }}
              />
              <AiSuggestion
                text={p.aiParagraph}
                onClear={() => up(p.id, "aiParagraph", "")}
                onAccept={() => {
                  up(p.id, "paragraph", p.aiParagraph);
                  up(p.id, "aiParagraph", "");
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
