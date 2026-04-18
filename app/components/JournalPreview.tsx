"use client";

import { useState, useEffect, useRef } from "react";
import { track } from "@vercel/analytics";
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
  onLogoClick: () => void;
  setVisualStyleKey: (k: VisualStyleKey) => void;
  setLayoutKey: (k: LayoutKey) => void;
  coverPhotoId: number | null;
  coverTitle: string;
  coverSubtitle: string;
}

export default function JournalPreview({
  tripTitle,
  tripBrief,
  dateDisplay,
  photos,
  visualStyleKey: vk,
  layoutKey: lo,
  onEdit,
  onLogoClick,
  setVisualStyleKey: setVkProp,
  setLayoutKey: setLoProp,
  coverPhotoId,
  coverTitle,
  coverSubtitle,
}: JournalPreviewProps) {
  const vs = VS[vk];
  const LayoutComponent = LayoutMap[lo];
  const coverPhoto = coverPhotoId !== null ? photos.find((p) => p.id === coverPhotoId) : null;
  const displayCoverTitle = coverTitle || tripTitle;

  const setVk = (k: VisualStyleKey) => {
    setVkProp(k);
    track("style_selected", { style: k });
  };
  const setLo = (k: LayoutKey) => {
    setLoProp(k);
    track("layout_selected", { layout: k });
  };
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!downloadOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDownloadOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [downloadOpen]);

  const handleExportPDF = async () => {
    setExporting("pdf");
    setDownloadOpen(false);
    track("download", { type: "pdf", visualStyle: vk, layout: lo, photoCount: photos.length });
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
    track("download", { type: "image", visualStyle: vk, layout: lo, photoCount: photos.length });
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

        <button
          onClick={onLogoClick}
          className="font-title bg-transparent border-none cursor-pointer"
          style={{ fontWeight: 400, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.5, color: "inherit", padding: 0 }}
        >
          Waymark
        </button>

        <div className="flex items-center gap-3">
          {/* Download dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDownloadOpen(!downloadOpen)}
              disabled={!!exporting}
              className="border-none cursor-pointer font-body"
              style={{
                color: vs.bg,
                fontSize: 11,
                fontWeight: 600,
                opacity: exporting ? 0.5 : 1,
                background: `${vs.bg}20`,
                padding: "4px 10px",
                borderRadius: 3,
              }}
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
                  Save as PDF
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
                  Save Image
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
      {coverPhoto ? (
        <div data-export-cover style={{ padding: "24px 24px 0" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 960,
              margin: "0 auto",
              aspectRatio: "16 / 9",
              borderRadius: vs.bg === "#0F0F0F" || vk === "brutalist" ? 0 : 5,
              overflow: "hidden",
            }}
          >
            <img
              src={coverPhoto.src}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            {/* Subtle full-photo darken + fully-centered text stack:
                Title → Date → Subtitle */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                padding: "32px",
                background: "rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <div
                className="wm-cover-title"
                style={{
                  fontFamily: vs.fontTitle,
                  fontSize: vk === "polaroid" ? 36 : vk === "brutalist" ? 24 : vk === "darkroom" ? 28 : vk === "botanical" ? 30 : 32,
                  fontWeight: 300,
                  color: "#fff",
                  textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                  lineHeight: 1.2,
                  marginBottom: 10,
                  maxWidth: "85%",
                  letterSpacing: vk === "darkroom" ? 2 : vk === "brutalist" ? 1 : 0,
                  textTransform: vk === "brutalist" || vk === "darkroom" ? "uppercase" : "none",
                }}
              >
                {displayCoverTitle}
              </div>
              {dateDisplay && (
                <div
                  style={{
                    fontFamily: vs.fontCaption,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.7)",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                    marginBottom: coverSubtitle ? 8 : 0,
                  }}
                >
                  {dateDisplay}
                </div>
              )}
              {coverSubtitle && (
                <div
                  className="wm-cover-subtitle"
                  style={{
                    fontFamily: vs.fontCaption,
                    fontStyle: "italic",
                    fontSize: vk === "polaroid" ? 15 : vk === "brutalist" ? 13 : vk === "darkroom" ? 14 : 16,
                    color: "rgba(255,255,255,0.85)",
                    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                    maxWidth: "80%",
                  }}
                >
                  {coverSubtitle}
                </div>
              )}
            </div>
          </div>
          {tripBrief && (
            <div
              style={{
                fontFamily: vs.fontBody,
                fontSize: 16,
                lineHeight: 1.8,
                maxWidth: 540,
                margin: "32px auto 0",
                opacity: 0.8,
                fontStyle: vk === "editorial" ? "italic" : "normal",
                whiteSpace: "pre-line",
                textAlign: "center",
              }}
            >
              {tripBrief}
            </div>
          )}
        </div>
      ) : (
        <div
          data-export-cover
          className="flex flex-col items-center text-center"
          style={{ padding: "60px 24px 40px" }}
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
          {tripBrief && (
            <div
              style={{
                fontFamily: vs.fontBody,
                fontSize: 16,
                lineHeight: 1.8,
                maxWidth: 540,
                marginTop: 22,
                opacity: 0.8,
                fontStyle: vk === "editorial" ? "italic" : "normal",
                whiteSpace: "pre-line",
              }}
            >
              {tripBrief}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div
        style={{
          maxWidth: lo === "filmstrip" ? 960 : 780,
          margin: "0 auto",
          padding: "36px 24px 80px",
        }}
      >

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
            fontSize: 11,
            opacity: 0.3,
          }}
        >
          Made with Waymark &middot; mywaymarks.com
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

{/* click-outside overlay removed — dropdown closes via onBlur */}
    </div>
  );
}
