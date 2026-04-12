"use client";

import { Photo, VisualStyle, VisualStyleKey } from "@/app/lib/types";
import PhotoCaption from "./PhotoCaption";
import { getBorderRadius } from "./utils";

interface LayoutProps {
  photos: Photo[];
  vs: VisualStyle;
  vk: VisualStyleKey;
}

export default function Grid({ photos, vs, vk }: LayoutProps) {
  const br = getBorderRadius(vk);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {photos.map((p) => (
        <div key={p.id}>
          <img
            src={p.src}
            style={{
              width: "100%",
              aspectRatio: "4/3",
              objectFit: "cover",
              borderRadius: br,
              display: "block",
            }}
            alt=""
          />
          <PhotoCaption photo={p} vs={vs} vk={vk} />
        </div>
      ))}
    </div>
  );
}
