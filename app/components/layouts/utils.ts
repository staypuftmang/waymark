import { VisualStyleKey } from "@/app/lib/types";

export function getBorderRadius(vk: VisualStyleKey): number {
  if (vk === "botanical") return 10;
  if (vk === "brutalist" || vk === "polaroid" || vk === "darkroom") return 0;
  return 4;
}
