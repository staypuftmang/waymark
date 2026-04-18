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

export default function Filmstrip({ photos, vs, vk, onPhotoClick }: LayoutProps) {
  const br = getBorderRadius(vk);
  return (
    <div data-layout="filmstrip" style={{ overflowX: "auto", display: "flex", gap: 14, paddingBottom: 16 }}>
      {photos.map((p) => (
        <div key={p.id} style={{ minWidth: "75%", maxWidth: "75%", flexShrink: 0 }}>
          <img
            src={p.src}
            onClick={onPhotoClick ? () => onPhotoClick(p.id) : undefined}
            style={{
              width: "100%",
              aspectRatio: "16/9",
              objectFit: "cover",
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
