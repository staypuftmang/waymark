import { VisualStyle, WordStyle, LayoutOption, LengthOption, VisualStyleKey, WordStyleKey, LayoutKey, LengthKey } from "./types";

export const VS: Record<VisualStyleKey, VisualStyle> = {
  editorial: {
    label: "Editorial",
    bg: "#FAF7F2",
    fg: "#1A1A1A",
    accent: "#C4553A",
    fontTitle: "'Playfair Display', Georgia, serif",
    fontBody: "'Source Serif 4', Georgia, serif",
    fontCaption: "'Manrope', sans-serif",
    captionStyle: "italic",
    pT: "A Week in Lisbon",
    pB: "Terracotta rooftops catching the last amber light.",
    pC: "The tram rattled through Alfama.",
  },
  polaroid: {
    label: "Polaroid",
    bg: "#F5F0E8",
    fg: "#3D3229",
    accent: "#8B6914",
    fontTitle: "'Caveat', cursive",
    fontBody: "'Nunito', sans-serif",
    fontCaption: "'Caveat', cursive",
    captionStyle: "normal",
    pT: "Summer on the Coast",
    pB: "Salt-crusted hair and sandy feet.",
    pC: "Found this cove after getting lost",
  },
  darkroom: {
    label: "Darkroom",
    bg: "#0F0F0F",
    fg: "#E8E8E8",
    accent: "#FF6B35",
    fontTitle: "'Bebas Neue', sans-serif",
    fontBody: "'Karla', sans-serif",
    fontCaption: "'Karla', sans-serif",
    captionStyle: "uppercase",
    pT: "Tokyo After Dark",
    pB: "Neon reflected in rain-slicked streets.",
    pC: "Shinjuku at 2AM.",
  },
  botanical: {
    label: "Botanical",
    bg: "#F0EDE4",
    fg: "#2C3E2D",
    accent: "#6B7F3B",
    fontTitle: "'Cormorant Garamond', serif",
    fontBody: "'Lora', serif",
    fontCaption: "'Josefin Sans', sans-serif",
    captionStyle: "normal",
    pT: "Scottish Highlands",
    pB: "Mist curling over lochs.",
    pC: "Morning fog over Glencoe.",
  },
  brutalist: {
    label: "Brutalist",
    bg: "#EBEBEB",
    fg: "#000",
    accent: "#FF0000",
    fontTitle: "'Anton', sans-serif",
    fontBody: "'Space Mono', monospace",
    fontCaption: "'Space Mono', monospace",
    captionStyle: "uppercase",
    pT: "Berlin, Unfiltered",
    pB: "Concrete and contradictions.",
    pC: "Kreuzberg wall.",
  },
};

export const WS: Record<WordStyleKey, WordStyle> = {
  poetic: {
    label: "Poetic",
    sys: "Write in a poetic, lyrical style with vivid sensory imagery. Be evocative, not flowery.",
  },
  minimal: {
    label: "Minimal",
    sys: "Write in a minimal style. Short, punchy, no excess.",
  },
  narrative: {
    label: "Narrative",
    sys: "Write in a narrative, story-driven style. Immersive and present-tense.",
  },
  witty: {
    label: "Witty",
    sys: "Write in a witty, playful style with dry observational humor.",
  },
  raw: {
    label: "Raw",
    sys: "Write in a raw, unfiltered style. Honest, direct, personal.",
  },
};

export const LO: Record<LayoutKey, LayoutOption> = {
  classic: {
    label: "Classic",
    icon: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="6" width="32" height="14" rx="1"/><line x1="6" y1="24" x2="30" y2="24"/></svg>',
  },
  magazine: {
    label: "Magazine",
    icon: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="5" width="32" height="13" rx="1"/><rect x="6" y="22" width="15" height="16" rx="1"/><rect x="24" y="22" width="14" height="8" rx="1"/></svg>',
  },
  grid: {
    label: "Grid",
    icon: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="15" height="15" rx="1"/><rect x="24" y="5" width="15" height="15" rx="1"/><rect x="5" y="24" width="15" height="15" rx="1"/><rect x="24" y="24" width="15" height="15" rx="1"/></svg>',
  },
  filmstrip: {
    label: "Filmstrip",
    icon: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="12" width="40" height="20" rx="1"/><line x1="16" y1="12" x2="16" y2="32"/><line x1="28" y1="12" x2="28" y2="32"/></svg>',
  },
  stacked: {
    label: "Stacked",
    icon: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="10" y="3" width="24" height="16" rx="1" transform="rotate(3 22 11)"/><rect x="8" y="15" width="24" height="16" rx="1" transform="rotate(-2 20 23)"/></svg>',
  },
};

export const LE: Record<LengthKey, LengthOption> = {
  brief: {
    label: "Brief",
    sys: "Write a short caption (1 sentence, under 15 words) and 1-2 sentences of body text. No pull quote. Keep it minimal.",
    showsPullQuote: false,
  },
  standard: {
    label: "Standard",
    sys: "Write an uppercase caption (under 15 words), an italic pull quote (1-2 sentences), and one paragraph of body text (80-120 words).",
    showsPullQuote: true,
  },
  detailed: {
    label: "Detailed",
    sys: "Write an uppercase caption (under 15 words), an italic pull quote (1-2 sentences), and 2-3 paragraphs of body text (200-300 words). Be richly descriptive.",
    showsPullQuote: true,
  },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function formatDate(d: Date | null): string {
  if (!d) return "";
  return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}

/**
 * Trim an LLM response down to the JSON payload it (hopefully) contains.
 * Models occasionally wrap output in ```json fences, prefix with prose
 * ("Here's the JSON:"), or trail off with a trailing comment. This:
 *   1. Strips ```json / ``` fences anywhere in the string.
 *   2. Truncates everything before the first { or [.
 *   3. Truncates everything after the matching last } or ].
 *
 * The first/last brace heuristic isn't perfect — if the model emits
 * two valid JSON blocks separated by prose, we'd over-include — but
 * for the single-document responses Waymark uses, it reliably rescues
 * fence-wrapped or commentary-prefixed output.
 */
export function cleanJson(raw: string): string {
  let s = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  // Pick whichever opening token comes first; the matching closing
  // token is the last one of the same family.
  const firstBrace = s.indexOf("{");
  const firstBracket = s.indexOf("[");
  const firstIdx =
    firstBrace === -1 ? firstBracket
      : firstBracket === -1 ? firstBrace
      : Math.min(firstBrace, firstBracket);
  if (firstIdx > 0) s = s.slice(firstIdx);
  const open = s[0];
  if (open === "{" || open === "[") {
    const close = open === "{" ? "}" : "]";
    const lastIdx = s.lastIndexOf(close);
    if (lastIdx >= 0 && lastIdx < s.length - 1) s = s.slice(0, lastIdx + 1);
  }
  return s.trim();
}

export { MONTHS };
