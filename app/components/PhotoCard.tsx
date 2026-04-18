"use client";

import { useState } from "react";
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
  onMove: (id: number, dir: number) => void;
  onRemove: (id: number) => void;
  title: string;
  brief: string;
  wordStyle: WordStyleKey;
  dateDisplay: string;
  isCover: boolean;
  onToggleCover: (id: number) => void;
}

export default function PhotoCard({
  photo: p,
  index: idx,
  total,
  onUpdate: up,
  onMove: mv,
  onRemove: rm,
  title,
  brief,
  wordStyle: ws,
  dateDisplay: dd,
  isCover,
  onToggleCover,
}: PhotoCardProps) {
  const [loadingCaption, setLC] = useState(false);
  const [loadingNotes, setLN] = useState(false);
  const [loadingParagraph, setLP] = useState(false);
  const [showParagraph, setSP] = useState(!!p.paragraph || !!p.aiParagraph);

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
    minHeight: 38,
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
    <div className="bg-card border border-border" style={{ borderRadius: 5, padding: 12 }}>
      <div className="flex gap-2.5">
        <div className="flex flex-col items-center gap-1 shrink-0">
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
          <div className="flex gap-0.5">
            {idx > 0 && (
              <button style={iconBtn} onClick={() => mv(p.id, -1)}>
                &#x2191;
              </button>
            )}
            {idx < total - 1 && (
              <button style={iconBtn} onClick={() => mv(p.id, 1)}>
                &#x2193;
              </button>
            )}
            <button style={{ ...iconBtn, color: "var(--color-accent)" }} onClick={() => rm(p.id)}>
              &#x00D7;
            </button>
          </div>
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
          <div className="flex gap-1 items-center">
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

          <div className="flex gap-1 items-start">
            <textarea
              placeholder="What's the story behind this moment?"
              value={p.notes}
              onChange={(e) => up(p.id, "notes", e.target.value)}
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
                placeholder="Full paragraph..."
                value={p.paragraph || ""}
                onChange={(e) => up(p.id, "paragraph", e.target.value)}
                style={{ ...textareaStyle, minHeight: 70, resize: "vertical", lineHeight: 1.6 }}
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
