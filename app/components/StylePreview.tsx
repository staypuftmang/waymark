"use client";

import { VisualStyle, VisualStyleKey } from "@/app/lib/types";

interface StylePreviewProps {
  styleKey: VisualStyleKey;
  style: VisualStyle;
  selected: boolean;
  onClick: () => void;
}

export default function StylePreview({ styleKey, style: s, selected, onClick }: StylePreviewProps) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer overflow-hidden bg-card"
      style={{
        border: selected ? "2px solid var(--color-accent)" : "1px solid var(--color-border)",
        borderRadius: 5,
      }}
    >
      <div style={{ background: s.bg, color: s.fg, padding: "12px 11px 10px", minHeight: 100 }}>
        <div
          style={{
            fontFamily: s.fontCaption,
            fontSize: 7,
            textTransform: "uppercase",
            letterSpacing: 2,
            opacity: 0.4,
            marginBottom: 3,
          }}
        >
          March 2026
        </div>
        <div
          style={{
            fontFamily: s.fontTitle,
            fontSize: 13,
            fontWeight: styleKey === "brutalist" ? 400 : 700,
            lineHeight: 1.15,
            textTransform: styleKey === "brutalist" || styleKey === "darkroom" ? "uppercase" : "none",
            marginBottom: 4,
          }}
        >
          {s.pT}
        </div>
        <div style={{ fontFamily: s.fontBody, fontSize: 8, lineHeight: 1.5, opacity: 0.55 }}>
          {s.pB}
        </div>
        <div style={{ width: 14, height: 1.5, background: s.accent, margin: "5px 0 3px" }} />
        <div style={{ fontFamily: s.fontCaption, fontSize: 7, opacity: 0.4 }}>{s.pC}</div>
      </div>
      <div className="flex items-center gap-1" style={{ padding: "7px 11px" }}>
        <div className="flex gap-0.5">
          {[s.bg, s.fg, s.accent].map((c, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: c,
                border: "1px solid rgba(0,0,0,.06)",
              }}
            />
          ))}
        </div>
        <span className="font-bold" style={{ fontSize: 11 }}>
          {s.label}
        </span>
      </div>
    </div>
  );
}
