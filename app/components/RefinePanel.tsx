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

  // Chip selection colors are FIXED to the base design system — they
  // never depend on the current visual style's accent. This prevents
  // e.g. Brutalist red (#FF0000) from being applied to chip borders.
  const CHIP_ACCENT = "#9A3412";
  const CHIP_ACCENT_BG = "rgba(154,52,18,0.12)";

  // Use rgba() for the unselected background rather than `${vs.fg}0A`.
  // Some VS.fg values use 3-char hex (e.g. Brutalist's "#000"), which
  // when concatenated with "0A" produces an invalid 5-char string and
  // the browser drops the background entirely — making stale styles
  // from a previous selection appear to linger.
  const panelIsDark = vs.bg.startsWith("#0") || vs.bg.toLowerCase() === "#000";
  const CHIP_BG_UNSEL = panelIsDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  const pill = (key: string, selected: boolean, onClick: () => void, label: string) => (
    <button
      key={key}
      type="button"
      onClick={(e) => {
        // Prevent the clicked button from keeping focus — otherwise the
        // browser focus ring can persist on a previously-selected pill
        // and visually mimic the selected border (Safari/iOS especially).
        (e.currentTarget as HTMLButtonElement).blur();
        onClick();
      }}
      className="font-body cursor-pointer"
      style={{
        padding: "4px 12px",
        borderRadius: 3,
        borderWidth: "1.5px",
        borderStyle: "solid",
        borderColor: selected ? CHIP_ACCENT : "transparent",
        background: selected ? CHIP_ACCENT_BG : CHIP_BG_UNSEL,
        color: vs.fg,
        fontSize: 11,
        fontWeight: selected ? 700 : 400,
        outline: "none",
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
