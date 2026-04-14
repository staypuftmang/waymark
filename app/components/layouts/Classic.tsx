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

export default function Classic({ photos, vs, vk }: LayoutProps) {
  const br = getBorderRadius(vk);
  const isMobile = useIsMobile();
  const entryGap = isMobile ? 20 : 40;
  const dividerMargin = isMobile ? 18 : 32;
  return (
    <div>
      {photos.map((p, i) => (
        <div key={p.id}>
          <div style={{ marginBottom: entryGap }}>
            <img
              src={p.src}
              style={{ width: "100%", borderRadius: br, display: "block" }}
              alt=""
            />
            <PhotoCaption photo={p} vs={vs} vk={vk} />
          </div>
          {i < photos.length - 1 && (
            <div
              style={{
                width: vk === "brutalist" ? "100%" : 32,
                height: vk === "brutalist" ? 3 : 1,
                margin: `${dividerMargin}px auto`,
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
