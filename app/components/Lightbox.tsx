"use client";

import { useEffect, useState, useRef } from "react";
import { Photo } from "@/app/lib/types";

interface LightboxProps {
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
}

const SWIPE_THRESHOLD = 50;

export default function Lightbox({ photos, startIndex, onClose }: LightboxProps) {
  const [current, setCurrent] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);
  const photo = photos[current];

  const goPrev = () => {
    if (current > 0) setCurrent((c) => c - 1);
  };
  const goNext = () => {
    if (current < photos.length - 1) setCurrent((c) => c + 1);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") {
        setCurrent((c) => (c < photos.length - 1 ? c + 1 : c));
      } else if (e.key === "ArrowLeft") {
        setCurrent((c) => (c > 0 ? c - 1 : c));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [photos.length, onClose]);

  // Lock page scroll while open
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, []);

  if (!photo) return null;

  const caption = photo.aiCaption || photo.caption;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > SWIPE_THRESHOLD) goNext();
    else if (diff < -SWIPE_THRESHOLD) goPrev();
    touchStartX.current = null;
  };

  return (
    <div
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="wm-lightbox"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "wmLightboxFade 200ms ease-out",
      }}
    >
      {/* Close button (top-right) */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "none",
          border: "none",
          color: "#fff",
          fontSize: 22,
          cursor: "pointer",
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.8,
        }}
      >
        &#x2715;
      </button>

      {/* Counter (top-center) */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          color: "#fff",
          fontSize: 13,
          opacity: 0.5,
          fontFamily: "var(--font-body)",
          letterSpacing: 0.5,
          pointerEvents: "none",
        }}
      >
        {current + 1} / {photos.length}
      </div>

      {/* Previous arrow */}
      {current > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          aria-label="Previous photo"
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: 36,
            cursor: "pointer",
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.6,
            lineHeight: 1,
          }}
        >
          &#x2039;
        </button>
      )}

      {/* Photo */}
      <img
        key={photo.id}
        src={photo.src}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "80vh",
          objectFit: "contain",
          borderRadius: 2,
          animation: "wmLightboxPhoto 200ms ease-out",
        }}
        alt=""
      />

      {/* Caption */}
      {caption && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            color: "#fff",
            fontSize: 13,
            opacity: 0.6,
            marginTop: 14,
            textAlign: "center",
            maxWidth: 640,
            lineHeight: 1.5,
            fontFamily: "var(--font-body)",
          }}
        >
          {caption}
        </div>
      )}

      {/* Next arrow */}
      {current < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          aria-label="Next photo"
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: 36,
            cursor: "pointer",
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.6,
            lineHeight: 1,
          }}
        >
          &#x203A;
        </button>
      )}
    </div>
  );
}
