"use client";

import { Photo } from "@/app/lib/types";
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
        <img
          src={cover.src}
          alt=""
          style={{
            width: 96,
            height: 54,
            objectFit: "cover",
            borderRadius: 3,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <HelperText>
            Landscape photos work best for covers. Your photo will be cropped to a 16:9 widescreen format.
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
