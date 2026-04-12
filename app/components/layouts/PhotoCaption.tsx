"use client";

import { Photo, VisualStyle, VisualStyleKey } from "@/app/lib/types";

interface PhotoCaptionProps {
  photo: Photo;
  vs: VisualStyle;
  vk: VisualStyleKey;
}

export default function PhotoCaption({ photo, vs, vk }: PhotoCaptionProps) {
  const cap = photo.aiCaption || photo.caption;
  const notes = photo.aiNotes || photo.notes;
  const para = photo.aiParagraph || photo.paragraph;

  return (
    <div style={{ marginTop: 10 }}>
      {cap && (
        <div
          style={{
            fontFamily: vs.fontCaption,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            opacity: 0.45,
          }}
        >
          {cap}
        </div>
      )}
      {notes && (
        <div
          style={{
            fontFamily: vs.fontBody,
            fontSize: vk === "polaroid" ? 16 : 14,
            lineHeight: 1.6,
            marginTop: 6,
            fontStyle: vs.captionStyle === "italic" ? "italic" : "normal",
          }}
        >
          {notes}
        </div>
      )}
      {para && (
        <div
          style={{
            fontFamily: vs.fontBody,
            fontSize: 14,
            lineHeight: 1.8,
            marginTop: 10,
            opacity: 0.85,
          }}
        >
          {para}
        </div>
      )}
    </div>
  );
}
