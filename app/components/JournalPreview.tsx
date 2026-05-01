"use client";

import { useState, useEffect, useRef } from "react";
import { track } from "@vercel/analytics";
import { Photo, VisualStyleKey, LayoutKey, LengthKey } from "@/app/lib/types";
import { VS, LO } from "@/app/lib/constants";
import { exportPDF, exportImage } from "@/app/lib/export";
import { LayoutMap } from "./layouts";
import RefinePanel from "./RefinePanel";
import Lightbox from "./Lightbox";
import HeaderAuthControls from "./HeaderAuthControls";
import SharePanel from "./SharePanel";
import { useAuth } from "@/app/lib/AuthContext";

interface JournalPreviewProps {
  tripTitle: string;
  tripBrief: string;
  dateDisplay: string;
  photos: Photo[];
  visualStyleKey: VisualStyleKey;
  layoutKey: LayoutKey;
  length?: LengthKey;
  onEdit: () => void;
  onLogoClick: () => void;
  setVisualStyleKey: (k: VisualStyleKey) => void;
  setLayoutKey: (k: LayoutKey) => void;
  coverPhotoId: number | null;
  coverTitle: string;
  coverSubtitle: string;
  onSignInClick?: () => void;
  onSignUpClick?: () => void;
  onYourJournals?: () => void;
  rateRemainingToday?: number | null;
  journalId?: string | null;
  shareSlug?: string | null;
  isPublic?: boolean;
  onShareChange?: (slug: string | null, isPublic: boolean) => void;
  onToast?: (msg: string) => void;
}

export default function JournalPreview({
  tripTitle,
  tripBrief,
  dateDisplay,
  photos,
  visualStyleKey: vk,
  layoutKey: lo,
  length: len = "standard",
  onEdit,
  onLogoClick,
  setVisualStyleKey: setVkProp,
  setLayoutKey: setLoProp,
  coverPhotoId,
  coverTitle,
  coverSubtitle,
  onSignInClick,
  onSignUpClick,
  onYourJournals,
  rateRemainingToday,
  journalId,
  shareSlug,
  isPublic,
  onShareChange,
  onToast,
}: JournalPreviewProps) {
  const { user } = useAuth();
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
  const [shareOpen, setShareOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const canShare = !!(user && journalId);

  const openLightbox = (photoId: number) => {
    const idx = photos.findIndex((p) => p.id === photoId);
    if (idx >= 0) setLightboxIndex(idx);
  };
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
      {/* Sticky header. WAYMARK left, action cluster right (Download · Share ·
          style label · auth). Edit removed — back to editor lives in the
          Refine panel's "Back" button. */}
      <div
        data-export-hide="top"
        className="sticky top-0 z-[100] flex justify-between items-center"
        style={{ background: vs.fg, color: vs.bg, padding: "10px 20px", fontSize: 11 }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onLogoClick}
            className="font-title bg-transparent border-none cursor-pointer"
            style={{ fontWeight: 400, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.7, color: "inherit", padding: 0 }}
          >
            Waymark
          </button>
          <button
            data-export-hide="edit"
            onClick={onEdit}
            className="hidden md:inline-flex items-center bg-transparent border-none cursor-pointer font-body"
            style={{
              color: "inherit",
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 10px",
              background: `${vs.bg}20`,
              borderRadius: 3,
              gap: 4,
            }}
          >
            <span aria-hidden>{"←"}</span>
            <span>Edit</span>
          </button>
        </div>

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
                className="wm-download-dropdown absolute z-[200]"
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
                {!user && onSignUpClick && (
                  <button
                    onClick={() => {
                      setDownloadOpen(false);
                      track("signup_prompt_clicked", { trigger: "download_dropdown" });
                      onSignUpClick();
                    }}
                    className="w-full text-left bg-transparent border-none cursor-pointer"
                    style={{
                      padding: "10px 14px",
                      fontSize: 11,
                      color: vs.fg,
                      opacity: 0.75,
                      fontFamily: "var(--font-body)",
                      lineHeight: 1.5,
                      borderTop: `1px solid ${vs.fg}11`,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = `${vs.fg}08`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Sign up to save this journal and access it from any device.
                  </button>
                )}
              </div>
            )}
          </div>

          {canShare && (
            <div className="relative" ref={shareRef} data-export-hide="share">
              <button
                onClick={() => setShareOpen((v) => !v)}
                className="border-none cursor-pointer font-body"
                style={{
                  color: vs.bg,
                  fontSize: 11,
                  fontWeight: 600,
                  background: `${vs.bg}20`,
                  padding: "4px 10px",
                  borderRadius: 3,
                }}
              >
                {"\u{1F517} Share"}
              </button>
              {shareOpen && journalId && (
                <SharePanel
                  journalId={journalId}
                  initialSlug={shareSlug ?? null}
                  initialIsPublic={!!isPublic}
                  onClose={() => setShareOpen(false)}
                  onChange={(slug, isPub) => onShareChange?.(slug, isPub)}
                  onToast={(msg) => onToast?.(msg)}
                  bg={vs.bg}
                  fg={vs.fg}
                  accent={vs.accent}
                />
              )}
            </div>
          )}

          <span className="hidden md:inline" style={{ opacity: 0.4, fontSize: 10 }}>
            {vs.label} / {LO[lo].label}
          </span>

          {typeof rateRemainingToday === "number" && rateRemainingToday < 10 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: vs.bg,
                opacity: rateRemainingToday <= 3 ? 1 : 0.85,
                whiteSpace: "nowrap",
              }}
              title="AI generations remaining today"
            >
              {rateRemainingToday} left today
            </span>
          )}

          {(onSignInClick || onSignUpClick || onYourJournals) && (
            <HeaderAuthControls
              onSignInClick={onSignInClick ?? (() => {})}
              onSignUpClick={onSignUpClick ?? (() => {})}
              onYourJournals={onYourJournals}
            />
          )}
        </div>
      </div>

      {/* Cover section */}
      {coverPhoto ? (
        <div data-export-cover style={{ padding: "24px 24px 0" }}>
          <div
            data-cover-hero
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 960,
              margin: "0 auto",
              borderRadius: vs.bg === "#0F0F0F" || vk === "brutalist" ? 0 : 5,
              overflow: "hidden",
              background: "var(--color-ink)",
            }}
          >
            <img
              src={coverPhoto.src}
              alt=""
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                maxHeight: "min(60vh, 600px)",
                objectFit: "contain",
                margin: "0 auto",
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
                  fontSize: vk === "polaroid" ? 44 : vk === "brutalist" ? 32 : vk === "darkroom" ? 36 : vk === "botanical" ? 38 : 40,
                  fontWeight: 700,
                  color: "#fff",
                  textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                  lineHeight: 1.15,
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
                    fontSize: 12,
                    color: "rgba(255,255,255,0.85)",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    textShadow: "0 2px 8px rgba(0,0,0,0.6)",
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
                    color: "#fff",
                    textShadow: "0 2px 8px rgba(0,0,0,0.6)",
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
        className="wm-journal-body"
        style={{
          maxWidth: lo === "filmstrip" ? 960 : 780,
          margin: "0 auto",
          padding: "36px 24px 80px",
        }}
      >

        <LayoutComponent photos={photos} vs={vs} vk={vk} len={len} onPhotoClick={openLightbox} />

        <div data-export-footer>
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

      {/* Lightbox — only rendered in the final journal preview */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
