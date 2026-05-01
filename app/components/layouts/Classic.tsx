"use client";

import { Photo, VisualStyle, VisualStyleKey, LengthKey } from "@/app/lib/types";
import PhotoCaption from "./PhotoCaption";
import { getBorderRadius } from "./utils";

interface LayoutProps {
  photos: Photo[];
  vs: VisualStyle;
  vk: VisualStyleKey;
  len?: LengthKey;
  onPhotoClick?: (photoId: number) => void;
}

export default function Classic({ photos, vs, vk, len, onPhotoClick }: LayoutProps) {
  const br = getBorderRadius(vk);
  return (
    <div>
      {photos.map((p, i) => (
        <div key={p.id}>
          <div className="wm-classic-entry" style={{ marginBottom: 40 }}>
            <img
              src={p.src}
              onClick={onPhotoClick ? () => onPhotoClick(p.id) : undefined}
              style={{
                width: "100%",
                borderRadius: br,
                display: "block",
                cursor: onPhotoClick ? "pointer" : "default",
              }}
              alt=""
            />
            <PhotoCaption photo={p} vs={vs} vk={vk} len={len} />
          </div>
          {i < photos.length - 1 && (
            <div
              className="wm-classic-divider"
              style={{
                width: vk === "brutalist" ? "100%" : 32,
                height: vk === "brutalist" ? 3 : 1,
                marginTop: 32,
                marginBottom: 32,
                marginLeft: "auto",
                marginRight: "auto",
                background: vs.accent,
                opacity: 0.15,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
