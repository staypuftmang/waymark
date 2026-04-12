import { LayoutKey } from "@/app/lib/types";
import Classic from "./Classic";
import Magazine from "./Magazine";
import Grid from "./Grid";
import Filmstrip from "./Filmstrip";
import Stacked from "./Stacked";
import type { Photo, VisualStyle, VisualStyleKey } from "@/app/lib/types";
import type { ComponentType } from "react";

export interface LayoutProps {
  photos: Photo[];
  vs: VisualStyle;
  vk: VisualStyleKey;
}

export const LayoutMap: Record<LayoutKey, ComponentType<LayoutProps>> = {
  classic: Classic,
  magazine: Magazine,
  grid: Grid,
  filmstrip: Filmstrip,
  stacked: Stacked,
};
