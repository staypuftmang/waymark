"use client";

import { Photo, VisualStyle, VisualStyleKey } from "@/app/lib/types";
import PhotoCaption from "./PhotoCaption";
import { getBorderRadius } from "./utils";

interface LayoutProps {
  photos: Photo[];
  vs: VisualStyle;
  vk: VisualStyleKey;
}

export default function Magazine({ photos, vs, vk }: LayoutProps) {
  const br = getBorderRadius(vk);

  const groups: Photo[][] = [];
  let i = 0;
  while (i < photos.length) {
    if (i === 0 || (groups.length > 0 && groups[groups.length - 1].length === 2)) {
      groups.push([photos[i]]);
      i++;
    } else {
      groups.push(photos.slice(i, i + 2));
      i += 2;
    }
  }

  return (
    <div>
      {groups.map((gr, gi) => (
        <div key={gi} style={{ marginBottom: 36 }}>
          {gr.length === 1 ? (
            <div>
              <img
                src={gr[0].src}
                style={{ width: "100%", borderRadius: br, display: "block" }}
                alt=""
              />
              <PhotoCaption photo={gr[0]} vs={vs} vk={vk} />
            </div>
          ) : (
            <div className="wm-magazine-pair">
              {gr.map((p) => (
                <div key={p.id}>
                  <img
                    src={p.src}
                    className="wm-pair-img"
                    style={{
                      width: "100%",
                      borderRadius: br,
                      display: "block",
                    }}
                    alt=""
                  />
                  <PhotoCaption photo={p} vs={vs} vk={vk} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
