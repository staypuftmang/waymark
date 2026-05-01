"use client";

import { Photo, VisualStyle, VisualStyleKey, LengthKey } from "@/app/lib/types";
import { LE } from "@/app/lib/constants";

interface PhotoCaptionProps {
  photo: Photo;
  vs: VisualStyle;
  vk: VisualStyleKey;
  len?: LengthKey;
}

export default function PhotoCaption({ photo, vs, vk, len = "standard" }: PhotoCaptionProps) {
  const cap = photo.aiCaption || photo.caption;
  const notes = photo.aiNotes || photo.notes;
  const para = photo.aiParagraph || photo.paragraph;
  const showNotes = LE[len].showsPullQuote;

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
      {showNotes && notes && (
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
            whiteSpace: "pre-wrap",
          }}
        >
          {para}
        </div>
      )}
    </div>
  );
}
