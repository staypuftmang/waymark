"use client";

import { useState } from "react";
import { Photo, VisualStyle, VisualStyleKey } from "@/app/lib/types";
import PhotoCaption from "./PhotoCaption";
import { getBorderRadius } from "./utils";

interface LayoutProps {
  photos: Photo[];
  vs: VisualStyle;
  vk: VisualStyleKey;
  onPhotoClick?: (photoId: number) => void;
}

const ROTATIONS = [-2.5, 1.8, -1.2, 2.8, -0.8, 1.5];

export default function Stacked({ photos, vs, vk, onPhotoClick }: LayoutProps) {
  const br = getBorderRadius(vk);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
      {photos.map((p, i) => {
        const rot = ROTATIONS[i % ROTATIONS.length];
        const isHovered = hovered === i;
        return (
          <div
            key={p.id}
            style={{
              background: vs.bg,
              border: `1px solid ${vs.fg}18`,
              borderRadius: br || 6,
              padding: vk === "polaroid" ? "10px 10px 28px" : "12px",
              boxShadow: "0 4px 20px rgba(0,0,0,.08)",
              transform: isHovered ? "rotate(0deg) scale(1.02)" : `rotate(${rot}deg)`,
              maxWidth: "85%",
              transition: "transform .3s",
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <img
              src={p.src}
              onClick={onPhotoClick ? () => onPhotoClick(p.id) : undefined}
              style={{
                width: "100%",
                borderRadius: vk === "polaroid" ? 0 : 3,
                display: "block",
                cursor: onPhotoClick ? "pointer" : "default",
              }}
              alt=""
            />
            <PhotoCaption photo={p} vs={vs} vk={vk} />
          </div>
        );
      })}
    </div>
  );
}
