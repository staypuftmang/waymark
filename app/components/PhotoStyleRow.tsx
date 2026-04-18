"use client";

import { useState } from "react";
import { Photo, WordStyleKey } from "@/app/lib/types";
import { aiCall } from "@/app/lib/ai";
import { rewriteCaptionPrompt, rewriteNotesPrompt, rewriteParagraphPrompt, generateParagraphPrompt } from "@/app/lib/prompts";
import AiButton from "./AiButton";

interface PhotoStyleRowProps {
  photo: Photo;
  onUpdate: (id: number, field: string, value: string) => void;
  title: string;
  brief: string;
  wordStyle: WordStyleKey;
  dateDisplay: string;
  isCover: boolean;
  onToggleCover: (id: number) => void;
}

export default function PhotoStyleRow({
  photo: p,
  onUpdate: up,
  title,
  brief,
  wordStyle: ws,
  dateDisplay: dd,
  isCover,
  onToggleCover,
}: PhotoStyleRowProps) {
  const [loadingCaption, setLC] = useState(false);
  const [loadingNotes, setLN] = useState(false);
  const [loadingParagraph, setLP] = useState(false);
  const [pending, setPending] = useState<Record<string, string>>({});

  const cap = p.aiCaption || p.caption;
  const notes = p.aiNotes || p.notes;
  const para = p.aiParagraph || p.paragraph;
  const hasCap = !!(p.caption || p.aiCaption);
  const hasNotes = !!(p.notes || p.aiNotes);
  const hasAny = hasCap || hasNotes;

  const rewrite = async (field: string, setLoading: (v: boolean) => void) => {
    const aiField = field === "caption" ? "aiCaption" : field === "notes" ? "aiNotes" : "aiParagraph";
    const raw = (p[aiField as keyof Photo] as string) || (p[field as keyof Photo] as string);
    if (!raw) return;
    setLoading(true);
    const prompt = field === "caption"
      ? rewriteCaptionPrompt(ws, title, brief, raw)
      : field === "notes"
        ? rewriteNotesPrompt(ws, title, brief, raw)
        : rewriteParagraphPrompt(ws, title, brief, raw);
    const t = await aiCall(prompt, p.src);
    if (t) setPending((v) => ({ ...v, [field]: t }));
    setLoading(false);
  };

  const generateParagraph = async () => {
    setLP(true);
    const capText = p.aiCaption || p.caption;
    const notesText = p.aiNotes || p.notes;
    const t = await aiCall(generateParagraphPrompt(ws, title, brief, capText, notesText), p.src);
    if (t) setPending((v) => ({ ...v, paragraph: t }));
    setLP(false);
  };

  const accept = (field: string) => {
    const aiField = field === "caption" ? "aiCaption" : field === "notes" ? "aiNotes" : "aiParagraph";
    up(p.id, aiField, pending[field]);
    setPending((v) => {
      const n = { ...v };
      delete n[field];
      return n;
    });
  };

  const reject = (field: string) => {
    setPending((v) => {
      const n = { ...v };
      delete n[field];
      return n;
    });
  };

  const renderPending = (field: string) => {
    if (!pending[field]) return null;
    return (
      <div
        style={{
          background: "rgba(154,52,18,.04)",
          border: "1px solid rgba(154,52,18,.12)",
          borderRadius: 3,
          padding: "6px 8px",
          fontSize: 12,
          lineHeight: 1.5,
          marginTop: 4,
        }}
      >
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-accent font-bold" style={{ fontSize: 9, letterSpacing: 1 }}>
            &#x2726; SUGGESTION
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => accept(field)}
              className="bg-accent text-white border-none font-semibold cursor-pointer"
              style={{ borderRadius: 3, padding: "2px 10px", fontSize: 10 }}
            >
              Accept
            </button>
            <button
              onClick={() => reject(field)}
              className="bg-transparent border-none cursor-pointer text-warm"
              style={{ fontSize: 11 }}
            >
              &#x2715;
            </button>
          </div>
        </div>
        <div>{pending[field]}</div>
      </div>
    );
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid var(--color-border)",
    borderRadius: 3,
    fontSize: 12,
    fontFamily: "var(--font-body)",
    outline: "none",
    color: "var(--color-ink)",
    background: "var(--color-card)",
  };

  const fields: [string, string, string][] = [
    ["caption", "aiCaption", "caption"],
    ["notes", "aiNotes", "notes"],
    ["paragraph", "aiParagraph", "paragraph"],
  ];

  return (
    <div className="bg-card border border-border" style={{ borderRadius: 5, padding: 12 }}>
      <div className="flex gap-2 items-start mb-2">
        <div className="relative shrink-0">
          <img
            src={p.src}
            className="object-cover"
            style={{ width: 48, height: 48, borderRadius: 3 }}
            alt=""
          />
          {isCover && (
            <div
              className="absolute"
              style={{
                top: 2,
                left: 2,
                background: "var(--color-accent)",
                color: "#fff",
                fontSize: 7,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                padding: "1px 4px",
                borderRadius: 2,
              }}
            >
              Cover
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center justify-between" style={{ minHeight: 48 }}>
          <div className="text-stone font-medium" style={{ fontSize: 12 }}>
            {cap || notes || "No content"}
          </div>
          <button
            onClick={() => onToggleCover(p.id)}
            className="bg-transparent cursor-pointer font-body shrink-0"
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 3,
              border: isCover ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
              color: isCover ? "var(--color-accent)" : "var(--color-stone)",
              whiteSpace: "nowrap",
              marginLeft: 8,
            }}
          >
            {isCover ? "Cover \u2713" : "Set as cover"}
          </button>
        </div>
      </div>

      <div className="grid gap-1.5">
        {fields.map(([field, aiField, label]) => {
          const hasContent = !!(p[aiField as keyof Photo] || p[field as keyof Photo]);
          const getAiButton = () => {
            if (field === "caption" && hasCap)
              return <AiButton onClick={() => rewrite("caption", setLC)} loading={loadingCaption} label="Rewrite" small />;
            if (field === "notes" && hasNotes)
              return <AiButton onClick={() => rewrite("notes", setLN)} loading={loadingNotes} label="Rewrite" small />;
            if (field === "paragraph" && hasAny)
              return <AiButton onClick={hasContent ? () => rewrite("paragraph", setLP) : generateParagraph} loading={loadingParagraph} label={hasContent ? "Rewrite" : "Generate"} small />;
            return null;
          };
          return (
            <div key={field}>
              <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                <div
                  className="text-warm font-bold uppercase"
                  style={{ fontSize: 9, letterSpacing: 1 }}
                >
                  {label}
                </div>
                {getAiButton()}
              </div>
              {field === "paragraph" ? (
                <textarea
                  value={(p[aiField as keyof Photo] as string) || (p[field as keyof Photo] as string) || ""}
                  onChange={(e) => up(p.id, p[aiField as keyof Photo] ? aiField : field, e.target.value)}
                  style={{ ...fieldStyle, resize: "vertical", minHeight: 56, lineHeight: 1.5 }}
                  placeholder={`Add ${label}...`}
                />
              ) : (
                <input
                  value={(p[aiField as keyof Photo] as string) || (p[field as keyof Photo] as string) || ""}
                  onChange={(e) => up(p.id, p[aiField as keyof Photo] ? aiField : field, e.target.value)}
                  style={fieldStyle}
                  placeholder={`Add ${label}...`}
                />
              )}
              {renderPending(field)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
