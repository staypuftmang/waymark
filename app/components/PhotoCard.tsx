"use client";

import { useState, useEffect, useRef } from "react";
import { Photo, focalPointToObjectPosition, isCustomFocalPoint } from "@/app/lib/types";
import { aiCall } from "@/app/lib/ai";
import { rewriteCaptionPrompt, rewriteNotesPrompt, generateParagraphPrompt } from "@/app/lib/prompts";
import { useJournal } from "@/app/context/JournalContext";
import AiButton from "./AiButton";
import AiSuggestion from "./AiSuggestion";
import HelperText from "./HelperText";

interface PhotoCardProps {
  photo: Photo;
  index: number;
  total: number;
  dragHandleProps?: Record<string, unknown>;
}

export default function PhotoCard({
  photo: p,
  index: idx,
  total,
  dragHandleProps,
}: PhotoCardProps) {
  // Pull journal context: title/brief/voice for prompt building, currentJournalId
  // for per-journal rate limiting, coverPhotoId to derive isCover, dispatch for
  // photo-field updates and remove/toggle-cover actions. The parent no longer
  // forwards any of these as props.
  const { state, dispatch } = useJournal();
  const { tripTitle: title, tripBrief: brief, ws, currentJournalId: journalId, coverPhotoId } = state;
  const isCover = coverPhotoId === p.id;
  const up = (id: number, field: string, value: string) =>
    dispatch({ type: "UPDATE_PHOTO_FIELD", id, field: field as keyof Photo, value });
  const rm = (id: number) => dispatch({ type: "REMOVE_PHOTO", id });
  const onToggleCover = (id: number) => dispatch({ type: "TOGGLE_COVER", id });
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
    const t = await aiCall(prompt, p.src, { actionType: "rewrite_single", journalId });
    if (t) up(p.id, aiField, t);
    setLoading(false);
  };

  const generateParagraph = async () => {
    setLP(true);
    const capText = p.aiCaption || p.caption;
    const notesText = p.aiNotes || p.notes;
    const t = await aiCall(generateParagraphPrompt(ws, title, brief, capText, notesText), p.src, { actionType: "rewrite_single", journalId });
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

        <div className="wm-photocard-thumb flex flex-col items-center gap-1 shrink-0" style={{ position: "relative" }}>
          <div style={{ position: "relative", width: 80, height: 80 }}>
            <img
              src={p.src}
              className="object-cover cursor-pointer"
              onClick={() => dispatch({ type: "OPEN_FOCAL_PICKER", id: p.id })}
              style={{
                width: 80,
                height: 80,
                borderRadius: 3,
                border: isCover ? "2px solid #C4A45A" : "2px solid transparent",
                objectPosition: focalPointToObjectPosition(p.focalPoint),
                display: "block",
              }}
              alt=""
              title="Tap to set focal point"
            />
            {/* Dedicated focal-point trigger. Sits on the thumbnail so
                discoverability doesn't depend on knowing the picture itself
                is clickable. The img onClick stays as a secondary trigger
                so a tap anywhere on the thumb still works. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "OPEN_FOCAL_PICKER", id: p.id });
              }}
              className="cursor-pointer border-none"
              aria-label="Set focal point"
              title="Set focal point"
              style={{
                position: "absolute",
                top: 4,
                left: 4,
                width: 22,
                height: 22,
                borderRadius: 4,
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <path d="M3 1 L1 1 L1 3" />
                <path d="M11 1 L13 1 L13 3" />
                <path d="M1 11 L1 13 L3 13" />
                <path d="M13 11 L13 13 L11 13" />
                <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
              </svg>
            </button>
            {isCustomFocalPoint(p.focalPoint) && (
              <span
                aria-label="Custom focal point"
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#C4A45A",
                  border: "1.5px solid #fff",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
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
                rows={5}
                style={{ ...textareaStyle, minHeight: 120, lineHeight: 1.6 }}
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
