"use client";

import { useState } from "react";
import { VisualStyle, VisualStyleKey, LayoutKey } from "@/app/lib/types";
import { VS, LO } from "@/app/lib/constants";

interface RefinePanelProps {
  vs: VisualStyle;
  vk: VisualStyleKey;
  setVk: (k: VisualStyleKey) => void;
  lo: LayoutKey;
  setLo: (k: LayoutKey) => void;
  onBack: () => void;
}

export default function RefinePanel({ vs, vk, setVk, lo, setLo, onBack }: RefinePanelProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed z-[200] flex items-center justify-center border-none cursor-pointer"
        style={{
          bottom: 20,
          right: 20,
          width: 44,
          height: 44,
          borderRadius: 4,
          background: vs.accent,
          color: "#fff",
          fontSize: 18,
          boxShadow: "0 4px 16px rgba(0,0,0,.2)",
        }}
      >
        &#x270E;
      </button>
    );
  }

  const pill = (key: string, selected: boolean, onClick: () => void, label: string) => (
    <button
      key={key}
      onClick={onClick}
      className="font-body cursor-pointer"
      style={{
        padding: "4px 12px",
        borderRadius: 3,
        border: selected ? `1.5px solid ${vs.accent}` : `1px solid ${vs.fg}22`,
        background: selected ? `${vs.accent}14` : "transparent",
        color: vs.fg,
        fontSize: 11,
        fontWeight: selected ? 700 : 400,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[200]"
      style={{
        background: vs.bg,
        borderTop: `2px solid ${vs.accent}`,
        boxShadow: "0 -8px 32px rgba(0,0,0,.12)",
        padding: "16px 20px 24px",
      }}
    >
      <div className="flex justify-between items-center mb-3.5">
        <span style={{ fontFamily: vs.fontTitle, fontSize: 18, fontWeight: 700, color: vs.fg }}>
          Refine
        </span>
        <button
          onClick={() => setOpen(false)}
          className="bg-transparent border-none cursor-pointer"
          style={{ fontSize: 16, color: vs.fg, opacity: 0.5 }}
        >
          &#x2715;
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          className="font-bold uppercase"
          style={{ fontSize: 9, letterSpacing: 1.5, color: vs.fg, opacity: 0.4, marginBottom: 6 }}
        >
          Visual
        </div>
        <div className="flex gap-1 flex-wrap">
          {(Object.entries(VS) as [VisualStyleKey, VisualStyle][]).map(([k, s]) =>
            pill(k, vk === k, () => setVk(k), s.label)
          )}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          className="font-bold uppercase"
          style={{ fontSize: 9, letterSpacing: 1.5, color: vs.fg, opacity: 0.4, marginBottom: 6 }}
        >
          Layout
        </div>
        <div className="flex gap-1 flex-wrap">
          {(Object.entries(LO) as [LayoutKey, { label: string }][]).map(([k, l]) =>
            pill(k, lo === k, () => setLo(k), l.label)
          )}
        </div>
      </div>

      <button
        onClick={onBack}
        className="font-body cursor-pointer"
        style={{
          padding: "7px 14px",
          borderRadius: 3,
          border: `1px solid ${vs.fg}22`,
          background: "transparent",
          color: vs.fg,
          fontSize: 11,
          marginTop: 4,
        }}
      >
        &#x2190; Edit content
      </button>
    </div>
  );
}
