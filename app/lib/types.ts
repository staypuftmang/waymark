export interface Photo {
  id: number;
  src: string;
  caption: string;
  notes: string;
  paragraph: string;
  aiCaption: string;
  aiNotes: string;
  aiParagraph: string;
}

export interface VisualStyle {
  label: string;
  bg: string;
  fg: string;
  accent: string;
  fontTitle: string;
  fontBody: string;
  fontCaption: string;
  captionStyle: string;
  pT: string;
  pB: string;
  pC: string;
}

export interface WordStyle {
  label: string;
  sys: string;
}

export interface LayoutOption {
  label: string;
  icon: string;
}

export type VisualStyleKey = "editorial" | "polaroid" | "darkroom" | "botanical" | "brutalist";
export type WordStyleKey = "poetic" | "minimal" | "narrative" | "witty" | "raw";
export type LayoutKey = "classic" | "magazine" | "grid" | "filmstrip" | "stacked";
export type LengthKey = "brief" | "standard" | "detailed";
export type Mode = "quick" | "full" | null;

export interface LengthOption {
  label: string;
  /** System-prompt fragment that tells the AI how much to write per photo. */
  sys: string;
  /** When true, the rendering layer omits the pull quote (notes) section. */
  showsPullQuote: boolean;
}
