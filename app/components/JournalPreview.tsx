"use client";

import { useState } from "react";
import { Photo, VisualStyleKey, LayoutKey } from "@/app/lib/types";
import { VS, LO } from "@/app/lib/constants";
import { exportPDF, exportImage } from "@/app/lib/export";
import { LayoutMap } from "./layouts";
import RefinePanel from "./RefinePanel";

interface JournalPreviewProps {
  tripTitle: string;
  tripBrief: string;
  dateDisplay: string;
  photos: Photo[];
  visualStyleKey: VisualStyleKey;
  layoutKey: LayoutKey;
  onEdit: () => void;
  setVisualStyleKey: (k: VisualStyleKey) => void;
  setLayoutKey: (k: LayoutKey) => void;
}

export default function JournalPreview({
  tripTitle,
  tripBrief,
  dateDisplay,
  photos,
  visualStyleKey: vk,
  layoutKey: lo,
  onEdit,
  setVisualStyleKey: setVk,
  setLayoutKey: setLo,
}: JournalPreviewProps) {
  const vs = VS[vk];
  const LayoutComponent = LayoutMap[lo];
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExportPDF = async () => {
    setExporting("pdf");
    setDownloadOpen(false);
    try {
      await exportPDF("journal-root", tripTitle, vs.bg, vs.fontCaption);
    } catch (e) {
      console.error("PDF export failed:", e);
    }
    setExporting(null);
  };

  const handleExportImage = async () => {
    setExporting("image");
    setDownloadOpen(false);
    try {
      await exportImage("journal-root", tripTitle, vs.bg);
    } catch (e) {
      console.error("Image export failed:", e);
    }
    setExporting(null);
  };

  return (
    <div id="journal-root" style={{ minHeight: "100vh", background: vs.bg, color: vs.fg }}>
      {/* Sticky header */}
      <div
        data-export-hide="top"
        className="sticky top-0 z-[100] flex justify-between items-center"
        style={{ background: vs.fg, color: vs.bg, padding: "10px 20px", fontSize: 11 }}
      >
        <button
          onClick={onEdit}
          className="bg-transparent border-none cursor-pointer"
          style={{ color: "inherit", fontSize: 11, opacity: 0.7 }}
        >
          &#x2190; Edit
        </button>

        <span
          className="font-title"
          style={{ fontWeight: 400, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.5 }}
        >
          Waymark
        </span>

        <div className="flex items-center gap-3">
          {/* Download dropdown */}
          <div className="relative">
            <button
              onClick={() => setDownloadOpen(!downloadOpen)}
              disabled={!!exporting}
              className="bg-transparent border-none cursor-pointer"
              style={{ color: "inherit", fontSize: 11, opacity: exporting ? 0.4 : 0.7 }}
            >
              {exporting
                ? exporting === "pdf" ? "Generating PDF\u2026" : "Generating image\u2026"
                : "\u2193 Download \u25BE"
              }
            </button>
            {downloadOpen && (
              <div
                className="absolute z-[200]"
                style={{
                  top: "calc(100% + 6px)",
                  right: 0,
                  background: vs.bg,
                  border: `1px solid ${vs.fg}22`,
                  borderRadius: 4,
                  boxShadow: "0 8px 24px rgba(0,0,0,.15)",
                  minWidth: 160,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={handleExportPDF}
                  className="w-full text-left bg-transparent border-none cursor-pointer"
                  style={{
                    padding: "10px 14px",
                    fontSize: 12,
                    color: vs.fg,
                    fontFamily: "var(--font-body)",
                    borderBottom: `1px solid ${vs.fg}11`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `${vs.fg}08`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  Download PDF
                </button>
                <button
                  onClick={handleExportImage}
                  className="w-full text-left bg-transparent border-none cursor-pointer"
                  style={{
                    padding: "10px 14px",
                    fontSize: 12,
                    color: vs.fg,
                    fontFamily: "var(--font-body)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `${vs.fg}08`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  Download Image
                </button>
              </div>
            )}
          </div>

          <span style={{ opacity: 0.4, fontSize: 10 }}>
            {vs.label} / {LO[lo].label}
          </span>
        </div>
      </div>

      {/* Cover section */}
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ minHeight: "40vh", padding: "48px 24px" }}
      >
        {dateDisplay && (
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 3,
              opacity: 0.35,
              marginBottom: 14,
            }}
          >
            {dateDisplay}
          </div>
        )}
        <h1
          style={{
            fontFamily: vs.fontTitle,
            fontSize: 38,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 520,
            textTransform: vk === "brutalist" || vk === "darkroom" ? "uppercase" : "none",
          }}
        >
          {tripTitle}
        </h1>
        <div
          style={{ width: 28, height: 1.5, background: vs.accent, margin: "22px auto 0" }}
        />
      </div>

      {/* Body */}
      <div
        style={{
          maxWidth: lo === "filmstrip" ? 960 : 780,
          margin: "0 auto",
          padding: "36px 24px 80px",
        }}
      >
        {tripBrief && (
          <p
            style={{
              fontFamily: vs.fontBody,
              fontSize: 16,
              lineHeight: 1.8,
              maxWidth: 540,
              margin: "0 auto 44px",
              textAlign: "center",
              opacity: 0.8,
              fontStyle: vk === "editorial" ? "italic" : "normal",
            }}
          >
            {tripBrief}
          </p>
        )}

        <LayoutComponent photos={photos} vs={vs} vk={vk} />

        <div
          style={{
            textAlign: "center",
            marginTop: 56,
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: 3,
            opacity: 0.2,
          }}
        >
          &#x2014; fin &#x2014;
        </div>

        {/* Export footer — visible in captures */}
        <div
          style={{
            textAlign: "center",
            marginTop: 40,
            fontFamily: vs.fontCaption,
            fontSize: 8,
            opacity: 0.3,
          }}
        >
          Made with Waymark
        </div>
      </div>

      {/* Refine panel */}
      <div data-export-hide="refine">
        <RefinePanel
          vs={vs}
          vk={vk}
          setVk={setVk}
          lo={lo}
          setLo={setLo}
          onBack={onEdit}
        />
      </div>

      {/* Close dropdown when clicking outside */}
      {downloadOpen && (
        <div
          className="fixed inset-0 z-[150]"
          onClick={() => setDownloadOpen(false)}
        />
      )}
    </div>
  );
}
