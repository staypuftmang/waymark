"use client";

import { Photo, focalPointToObjectPosition, isCustomFocalPoint } from "@/app/lib/types";
import { useJournal } from "@/app/context/JournalContext";
import HelperText from "./HelperText";

interface CoverEditorProps {
  photos: Photo[];
  coverPhotoId: number | null;
  coverTitle: string;
  coverSubtitle: string;
  onRemoveCover: () => void;
  onUpdateCoverTitle: (value: string) => void;
  onUpdateCoverSubtitle: (value: string) => void;
}

export default function CoverEditor({
  photos,
  coverPhotoId,
  coverTitle,
  coverSubtitle,
  onRemoveCover,
  onUpdateCoverTitle,
  onUpdateCoverSubtitle,
}: CoverEditorProps) {
  const { dispatch } = useJournal();
  if (coverPhotoId === null) return null;
  const cover = photos.find((p) => p.id === coverPhotoId);
  if (!cover) return null;

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "var(--color-stone)",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--color-border)",
    borderRadius: 5,
    fontSize: 14,
    fontFamily: "var(--font-body)",
    background: "var(--color-card)",
    outline: "none",
    color: "var(--color-ink)",
  };

  return (
    <div
      className="bg-card border border-border"
      style={{ borderRadius: 5, padding: 16, marginBottom: 20 }}
    >
      <div style={labelStyle}>Cover</div>

      <div className="flex gap-3 items-start" style={{ marginBottom: 14 }}>
        <div style={{ position: "relative", flexShrink: 0, width: 96, height: 54 }}>
          <img
            src={cover.src}
            alt=""
            onClick={() => dispatch({ type: "OPEN_FOCAL_PICKER", id: cover.id })}
            title="Tap to set focal point"
            className="cursor-pointer"
            style={{
              width: 96,
              height: 54,
              objectFit: "cover",
              objectPosition: focalPointToObjectPosition(cover.focalPoint),
              borderRadius: 3,
              display: "block",
            }}
          />
          {/* Dedicated focal-point trigger — same affordance as PhotoCard
              so the cover and body photo flows feel consistent. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "OPEN_FOCAL_PICKER", id: cover.id });
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
          {isCustomFocalPoint(cover.focalPoint) && (
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
        <div style={{ flex: 1 }}>
          <HelperText>
            Your cover crops to a 16:9 widescreen. Tap the crop icon on the thumbnail to set the focal point.
          </HelperText>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Cover Title</label>
        <input
          type="text"
          value={coverTitle}
          placeholder="Cover title..."
          onChange={(e) => onUpdateCoverTitle(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Cover Subtitle (optional)</label>
        <input
          type="text"
          value={coverSubtitle}
          placeholder="Add a subtitle..."
          onChange={(e) => onUpdateCoverSubtitle(e.target.value)}
          style={inputStyle}
        />
      </div>

      <button
        onClick={onRemoveCover}
        className="bg-transparent border-none cursor-pointer text-accent font-body"
        style={{ fontSize: 12, fontWeight: 600, padding: 0 }}
      >
        Remove cover
      </button>
    </div>
  );
}
