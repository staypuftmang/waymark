"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FocalPoint } from "@/app/lib/types";
import { focalPointToObjectPosition } from "@/app/lib/types";
import { Button } from "./ui";

interface FocalPointPickerProps {
  src: string;
  initial: FocalPoint | undefined;
  /** Which crop ratio the toggle starts on. Pass "cover" when launched
   * from the cover thumbnail, "body" when launched from a body photo. */
  initialMode?: CropMode;
  onApply: (next: FocalPoint | null) => void;
  onClose: () => void;
}

type CropMode = "cover" | "body";
type CropAxis = "x" | "y" | "none";

const COVER_RATIO = 16 / 9;
const BODY_RATIO = 1; // square — matches the photo-management thumbnail
const DEFAULT_FOCAL: FocalPoint = { x: 50, y: 50 };

/**
 * Modal that lets the user pick a focal point on a photo. The full image
 * fills the modal; the area that *won't* be visible after cover-cropping
 * is dimmed with a semi-transparent overlay so the user can see exactly
 * what will be kept and what will be cropped at the toggled aspect ratio.
 *
 * The overlay window math:
 *   given (imgW, imgH) and target ratio r,
 *   if imgW / imgH > r → image is wider than the target, so the kept
 *     window has the full height and width = imgH * r; horizontal slot
 *     positions according to focal x.
 *   else → image is taller, kept window has full width and height
 *     = imgW / r; vertical slot positions according to focal y.
 *
 * Pointer events (not just mouse) so it works under touch without the
 * 300ms tap delay or scroll-jacking. The picker stops touch events from
 * propagating up to the page so the overlay drag doesn't trigger pull-
 * to-refresh or accidental scroll.
 */
export default function FocalPointPicker({
  src,
  initial,
  initialMode = "body",
  onApply,
  onClose,
}: FocalPointPickerProps) {
  const [mode, setMode] = useState<CropMode>(initialMode);
  const [focal, setFocal] = useState<FocalPoint>(initial ?? DEFAULT_FOCAL);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Esc closes; identical to the share / delete confirm pattern.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ratio = mode === "cover" ? COVER_RATIO : BODY_RATIO;

  /** Which axis of the photo actually gets cropped at the current ratio.
   *  Wider-than-target → vertical bands trimmed left/right → "x" axis.
   *  Taller-than-target → horizontal bands trimmed top/bottom → "y" axis.
   *  Same ratio → nothing to crop, picker is informational only. */
  const cropAxis: CropAxis = useMemo(() => {
    if (!imgSize) return "none";
    const imgRatio = imgSize.w / imgSize.h;
    if (Math.abs(imgRatio - ratio) < 0.001) return "none";
    return imgRatio > ratio ? "x" : "y";
  }, [imgSize, ratio]);

  /** Convert a pointer event on the stage div to a focal-point % pair.
   *  Only the cropped axis updates — the other axis preserves whatever
   *  value the focal point already had, so toggling between body/cover
   *  modes doesn't wipe a setting the user made on the other axis. */
  const pointToFocal = (e: PointerEvent | React.PointerEvent): FocalPoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const r = stage.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const rawX = ((e.clientX - r.left) / r.width) * 100;
    const rawY = ((e.clientY - r.top) / r.height) * 100;
    const x = Math.max(0, Math.min(100, rawX));
    const y = Math.max(0, Math.min(100, rawY));
    if (cropAxis === "x") return { x, y: focal.y };
    if (cropAxis === "y") return { x: focal.x, y };
    return focal;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (cropAxis === "none") return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const next = pointToFocal(e);
    if (next) setFocal(next);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const next = pointToFocal(e);
    if (next) setFocal(next);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const reset = () => setFocal(DEFAULT_FOCAL);

  const done = () => {
    // Persist null when the user lands on dead-center so customised-photo
    // detection (the indicator dot) reads cleanly.
    const isDefault = focal.x === 50 && focal.y === 50;
    onApply(isDefault ? null : focal);
    onClose();
  };

  /** Visible-after-crop window expressed as % of the source image. */
  const cropWindow = useMemo(() => {
    if (!imgSize) return null;
    const { w, h } = imgSize;
    const imgRatio = w / h;
    if (imgRatio > ratio) {
      // Image is wider than the target — the crop window is the full
      // height, narrower than the image. Slide horizontally based on
      // focal.x; clamp to image bounds so the window can't fall off.
      const winWidthPct = (ratio / imgRatio) * 100;
      const halfPct = winWidthPct / 2;
      const cx = Math.max(halfPct, Math.min(100 - halfPct, focal.x));
      return {
        leftPct: cx - halfPct,
        topPct: 0,
        widthPct: winWidthPct,
        heightPct: 100,
      };
    }
    const winHeightPct = (imgRatio / ratio) * 100;
    const halfPct = winHeightPct / 2;
    const cy = Math.max(halfPct, Math.min(100 - halfPct, focal.y));
    return {
      leftPct: 0,
      topPct: cy - halfPct,
      widthPct: 100,
      heightPct: winHeightPct,
    };
  }, [imgSize, ratio, focal.x, focal.y]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border"
        style={{
          borderRadius: 8,
          padding: 20,
          width: "100%",
          maxWidth: 880,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          // Stop touch scroll bleeding through the modal.
          touchAction: "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div className="font-title" style={{ fontSize: 18, color: "var(--color-ink)" }}>
              Focal point
            </div>
            <div className="text-stone" style={{ fontSize: 12, marginTop: 2, fontFamily: "var(--font-body)" }}>
              Tap or drag on the photo to set what stays in frame.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-none cursor-pointer"
            style={{ padding: 4, fontSize: 18, color: "var(--color-stone)", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Crop context toggle */}
        <div
          style={{
            display: "inline-flex",
            border: "1px solid var(--color-border)",
            borderRadius: 999,
            padding: 2,
            marginBottom: 16,
            background: "var(--color-paper)",
          }}
        >
          {(["body", "cover"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="cursor-pointer border-none"
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 12,
                fontFamily: "var(--font-body)",
                background: mode === m ? "var(--color-ink)" : "transparent",
                color: mode === m ? "var(--color-card)" : "var(--color-ink)",
              }}
            >
              {m === "body" ? "Body crop" : "Cover crop"}
            </button>
          ))}
        </div>

        <div className="wm-focal-grid">
          {/* Stage (full photo + bright crop window). The wrapper takes
              the IMAGE'S natural aspect ratio so percentage-positioned
              overlays line up with the rendered pixels — using object-fit
              contain on the img would letterbox inside the box and the
              overlay percentages would be relative to the box, not the
              picture, throwing off the crop window. The maxWidth/maxHeight
              constraints keep the stage from blowing past the modal. */}
          <div
            className="wm-focal-stage-wrap"
            style={{
              position: "relative",
              width: "100%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              ref={stageRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="wm-focal-stage"
              style={{
                position: "relative",
                ...(imgSize
                  ? {
                      aspectRatio: `${imgSize.w} / ${imgSize.h}`,
                      width: "100%",
                      maxWidth: "100%",
                      maxHeight: "60vh",
                    }
                  : { width: "100%", aspectRatio: "16 / 9" }),
                userSelect: "none",
                touchAction: "none",
                cursor: cropAxis === "none" ? "default" : "crosshair",
                background: "#000",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                draggable={false}
                onLoad={(e) => {
                  const t = e.target as HTMLImageElement;
                  setImgSize({ w: t.naturalWidth, h: t.naturalHeight });
                }}
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  // No object-fit needed — the wrapper aspect ratio matches
                  // the image, so the natural fit fills it cleanly.
                  pointerEvents: "none",
                }}
              />
              {/* The crop window stays bright; everything outside it is
                  dimmed via an outward box-shadow. One element, no
                  compositing hacks — the spread radius covers any
                  practical container size. */}
              {cropWindow && (
                <div
                  style={{
                    position: "absolute",
                    left: `${cropWindow.leftPct}%`,
                    top: `${cropWindow.topPct}%`,
                    width: `${cropWindow.widthPct}%`,
                    height: `${cropWindow.heightPct}%`,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                    border: "2px solid #fff",
                    pointerEvents: "none",
                  }}
                />
              )}
              {/* Focal-point reticle. Position uses the locked axis
                  values so the reticle sits on the slide line, not in
                  some dead-zone the user can't reach by dragging. */}
              <div
                style={{
                  position: "absolute",
                  left: `${cropAxis === "y" ? 50 : focal.x}%`,
                  top: `${cropAxis === "x" ? 50 : focal.y}%`,
                  width: 18,
                  height: 18,
                  marginLeft: -9,
                  marginTop: -9,
                  borderRadius: "50%",
                  border: "2px solid #fff",
                  background: "rgba(0,0,0,0.4)",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="wm-focal-preview">
            <div
              className="text-stone"
              style={{
                fontSize: 11,
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Preview
            </div>
            <div
              style={{
                width: "100%",
                aspectRatio: ratio === COVER_RATIO ? "16 / 9" : "1 / 1",
                background: "var(--color-paper)",
                borderRadius: 4,
                overflow: "hidden",
                border: "1px solid var(--color-border)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: focalPointToObjectPosition(focal),
                  display: "block",
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
            gap: 8,
          }}
        >
          <Button variant="ghost" onClick={reset}>
            Reset to center
          </Button>
          <Button onClick={done}>Done</Button>
        </div>
      </div>

      <style jsx>{`
        .wm-focal-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .wm-focal-preview {
          width: 100%;
        }
        @media (min-width: 720px) {
          .wm-focal-grid {
            grid-template-columns: minmax(0, 1fr) 200px;
            align-items: start;
            gap: 20px;
          }
          .wm-focal-preview {
            width: 200px;
          }
        }
      `}</style>
    </div>
  );
}
