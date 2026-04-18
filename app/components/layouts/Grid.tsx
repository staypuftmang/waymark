"use client";

import { Photo, VisualStyle, VisualStyleKey } from "@/app/lib/types";
import PhotoCaption from "./PhotoCaption";
import { getBorderRadius } from "./utils";

interface LayoutProps {
  photos: Photo[];
  vs: VisualStyle;
  vk: VisualStyleKey;
  onPhotoClick?: (photoId: number) => void;
}

export default function Grid({ photos, vs, vk, onPhotoClick }: LayoutProps) {
  const br = getBorderRadius(vk);
  return (
    <div className="wm-grid-layout">
      {photos.map((p) => (
        <div key={p.id}>
          <img
            src={p.src}
            onClick={onPhotoClick ? () => onPhotoClick(p.id) : undefined}
            style={{
              width: "100%",
              objectFit: "contain",
              borderRadius: br,
              display: "block",
              cursor: onPhotoClick ? "pointer" : "default",
            }}
            alt=""
          />
          <PhotoCaption photo={p} vs={vs} vk={vk} />
        </div>
      ))}
    </div>
  );
}
