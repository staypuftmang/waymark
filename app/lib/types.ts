export interface FocalPoint {
  /** 0-100 percentage from the left of the image. */
  x: number;
  /** 0-100 percentage from the top of the image. */
  y: number;
}

export interface Photo {
  id: number;
  src: string;
  caption: string;
  notes: string;
  paragraph: string;
  aiCaption: string;
  aiNotes: string;
  aiParagraph: string;
  /** User-picked point of interest for object-position cropping.
   * Absent (or {50,50}) means default center. Stored on journal_photos
   * as focal_x / focal_y smallint columns. */
  focalPoint?: FocalPoint;
}

/** CSS object-position value for a Photo's focal point — defaults to
 * "50% 50%" when the photo has no customisation. */
export function focalPointToObjectPosition(p?: FocalPoint): string {
  const x = p?.x ?? 50;
  const y = p?.y ?? 50;
  return `${x}% ${y}%`;
}

/** True if the focal point has been moved away from the default center.
 * Used to decide whether to render the customisation indicator dot. */
export function isCustomFocalPoint(p?: FocalPoint): boolean {
  if (!p) return false;
  return p.x !== 50 || p.y !== 50;
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
