"use client";

import { Photo, VisualStyle, VisualStyleKey } from "@/app/lib/types";
import PhotoCaption from "./PhotoCaption";
import { getBorderRadius } from "./utils";
import { useIsMobile } from "@/app/lib/useMediaQuery";

interface LayoutProps {
  photos: Photo[];
  vs: VisualStyle;
  vk: VisualStyleKey;
}

export default function Grid({ photos, vs, vk }: LayoutProps) {
  const br = getBorderRadius(vk);
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 28 : 16 }}>
      {photos.map((p) => (
        <div key={p.id}>
          <img
            src={p.src}
            style={{
              width: "100%",
              objectFit: "contain",
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
