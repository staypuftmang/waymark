import { WordStyleKey, LengthKey } from "./types";
import { WS, LE } from "./constants";

const BANNED_PHRASES = [
  "breathtaking views", "breathtaking scenery", "breathtaking",
  "hidden gem", "feast for the senses", "time stood still",
  "memories that will last a lifetime", "the journey is the destination",
  "off the beaten path", "a world away", "melting pot of cultures",
  "picture-perfect", "steeped in history", "bustling streets",
];

function systemPrompt(ws: WordStyleKey, len: LengthKey = "standard"): string {
  return `You are writing entries for a personal travel journal.

${WS[ws].sys}

LENGTH: ${LE[len].sys}

CRITICAL RULES:
- LOOK AT THE PHOTO FIRST. Your writing must describe what you actually see in the image — the specific subject, colors, light, people, scene, objects. Do not write generic travel prose.
- The trip brief is BACKGROUND CONTEXT ONLY. Do NOT copy, quote, paraphrase, or closely echo any part of it. Write completely original content grounded in what the photo shows.
- Each photo entry must be unique. Do not repeat phrases, imagery, or sentence structures you've already used for other photos in this journal.
- Write as if you are the traveler recounting this specific moment. Be concrete and sensory — what you saw, heard, smelled, tasted, felt.
- Avoid these overused phrases: ${BANNED_PHRASES.map((p) => `"${p}"`).join(", ")}`;
}

function truncateBrief(brief: string): string {
  return brief.length > 200 ? brief.substring(0, 200) + "..." : brief;
}

const VOICE_INSTRUCTIONS: Record<WordStyleKey, string> = {
  poetic: "Write in a lyrical, sensory, emotionally rich style.",
  minimal: "Write in short, understated, sparse sentences. Less is more.",
  narrative: "Write in a storytelling style with a clear narrative arc.",
  witty: "Write with humor, personality, and sharp observations.",
  raw: "Write in an honest, unpolished, stream-of-consciousness style.",
};

/**
 * Prompt for the AI Trip Brief Generator (Quick Create). Looks at a batch of
 * low-res photos plus any context the user has filled in (title / dates / voice),
 * and returns a 2-3 sentence first-person brief that sets the tone for the
 * journal generation. The brief is written in the same voice that will be
 * used for the rest of the journal so the whole thing feels cohesive.
 * Output is plain text (no JSON).
 */
export function tripBriefFromPhotosPrompt(
  title: string,
  dates: string,
  photoCount: number,
  voice?: WordStyleKey | null,
): string {
  const v = voice && VOICE_INSTRUCTIONS[voice] ? voice : "narrative";
  const voiceInstruction = VOICE_INSTRUCTIONS[v];

  const ctxParts: string[] = [];
  if (title) ctxParts.push(`Trip title: "${title}"`);
  if (dates) ctxParts.push(`Dates: ${dates}`);
  const ctx = ctxParts.length ? `\n\nCONTEXT:\n- ${ctxParts.join("\n- ")}` : "";

  return `You are helping someone write a trip brief for their travel journal. Look at all the photos together and write a 2-3 sentence brief that captures the essence of this trip — the mood, the highlights, the emotional through-line. Write in first person. Be specific about what you see in the photos but keep it concise. This brief will be used as context for a longer AI-generated journal, so it should set the tone without telling the whole story. Do NOT list what's in each photo. Write it as one flowing thought.

VOICE: ${voiceInstruction} The brief must read in this voice — the same voice that will write the rest of the journal.${ctx}

You're looking at ${photoCount} photo${photoCount === 1 ? "" : "s"} from this trip.

Return ONLY the brief — no preamble, no quotes, no JSON, no markdown. Just the 2-3 sentences.`;
}

function tripContext(title: string, brief: string, dates: string): string {
  const parts = [`- Trip title: "${title}"`];
  if (brief) parts.push(`- Trip story: "${truncateBrief(brief)}"`);
  if (dates) parts.push(`- Dates: ${dates}`);
  return parts.join("\n");
}

export function quickCreatePrompt(
  ws: WordStyleKey,
  title: string,
  brief: string,
  dates: string,
  index: number,
  total: number,
  previousCaptions: string[],
  len: LengthKey = "standard",
): string {
  const aspects = [
    "a taste or smell — food, coffee, sea air, pine, dust",
    "a sound — music, conversation, wind, silence, an animal",
    "a person — a companion, a stranger, a local you met",
    "the light — golden hour, harsh noon, dawn, neon, candlelight",
    "a texture — stone, sand, fabric, water, cold metal",
    "an emotion — nerves, wonder, exhaustion, joy, homesickness",
    "movement — walking, driving, climbing, floating, running",
    "weather — rain, heat, fog, crisp cold, a sudden storm",
  ];
  const aspect = aspects[index % aspects.length];

  let arc = "the heart of the trip — a deeper experience, an unexpected moment, a connection";
  if (index === 0) arc = "the very beginning — the first moment, arrival, stepping into the unknown";
  else if (index === 1) arc = "early days — settling in, first impressions, getting your bearings";
  else if (index === total - 1) arc = "the final moment — departure, last looks, what you carry home";
  else if (index === total - 2) arc = "nearing the end — bittersweet, savoring the last days";

  const prevBlock = previousCaptions.length > 0
    ? `\nPREVIOUS CAPTIONS ALREADY WRITTEN (you MUST write something completely different — different subject, different imagery, different sentence structure):
${previousCaptions.map((c, i) => `  Photo ${i + 1}: "${c}"`).join("\n")}
`
    : "";

  const notesField = len === "brief"
    ? `"notes": "" (empty string — Brief length skips the pull quote)`
    : `"notes": "1-2 sentences — what you see and feel about THIS specific moment, with ${aspect}"`;
  const paragraphField = len === "brief"
    ? `"paragraph": "1-2 sentences — what's visible in THIS photo, with ${aspect}. Concrete and minimal."`
    : len === "detailed"
      ? `"paragraph": "2-3 paragraphs (200-300 words total) — bring THIS specific photo to life with rich, layered ${aspect} details. Describe what's actually visible. Use paragraph breaks (\\n\\n) between paragraphs. No clichés."`
      : `"paragraph": "1 paragraph (80-120 words) — bring THIS specific photo to life with concrete ${aspect} details. Describe what's actually visible. No clichés."`;

  return `${systemPrompt(ws, len)}

LOOK AT THE PHOTO ABOVE. Describe what you actually see — the specific subject, scene, objects, people, light, colors, atmosphere.

Write content for THIS photo (photo ${index + 1} of ${total}) in a personal travel journal.

CONTEXT (do not copy or repeat — background only):
${tripContext(title, brief, dates)}
${prevBlock}
This is photo ${index + 1} of ${total}. Narrative moment: ${arc}.

FOCUS THIS ENTRY ON: ${aspect}. Build the entry around what's visible in the photo, leaning into this sensory dimension.

UNIQUENESS RULES:
- Your caption MUST start with a different word than any previous caption.
- Your paragraph MUST focus on a different subject/scene than previous entries.
- Every sentence must connect to what is actually in THIS photo.
- Each entry should feel like a distinct moment, not a variation of the same scene.

Return ONLY valid JSON:
{"caption": "1 short sentence — a specific label for what's in THIS photo, starting with a unique word", ${notesField}, ${paragraphField}}

JSON only, no markdown, no commentary.`;
}

export function rewriteCaptionPrompt(
  ws: WordStyleKey,
  title: string,
  brief: string,
  caption: string
): string {
  return `${systemPrompt(ws)}

LOOK AT THE PHOTO ABOVE. Rewrite this caption to better match what's visible in the image.

Trip context (background only, do not copy): "${title}" — ${truncateBrief(brief)}

Original: "${caption}"

Write a single sentence that works as a photo label — short, specific to what's in THIS photo, not generic.
Return ONLY the rewritten sentence.`;
}

export function rewriteNotesPrompt(
  ws: WordStyleKey,
  title: string,
  brief: string,
  notes: string
): string {
  return `${systemPrompt(ws)}

LOOK AT THE PHOTO ABOVE. Rewrite these notes to better match what's visible in the image.

Trip context (background only, do not copy): "${title}" — ${truncateBrief(brief)}

Original: "${notes}"

Write 1-2 sentences that capture what you see in THIS photo. Use specific details visible in the image — subjects, light, colors, atmosphere. Not generic travel prose.
Return ONLY the rewritten text.`;
}

export function rewriteParagraphPrompt(
  ws: WordStyleKey,
  title: string,
  brief: string,
  paragraph: string
): string {
  return `${systemPrompt(ws)}

LOOK AT THE PHOTO ABOVE. Rewrite this paragraph to describe what's actually in the image.

Trip context (background only, do not copy): "${title}" — ${truncateBrief(brief)}

Original: "${paragraph}"

Write 3-5 sentences grounded in what you SEE in THIS photo — colors, subjects, light, textures, emotions.
Do NOT use clichés. Every sentence should connect to the image.
Return ONLY the rewritten paragraph.`;
}

export function generateParagraphPrompt(
  ws: WordStyleKey,
  title: string,
  brief: string,
  caption: string,
  notes: string
): string {
  return `${systemPrompt(ws)}

LOOK AT THE PHOTO ABOVE. Write a paragraph for a travel journal entry about what you see.

Trip context (background only, do not copy): "${title}"
Photo caption: "${caption}"
Photo notes: "${notes}"

Write 3-5 sentences that bring THIS specific photo to life. Describe what's actually visible:
- The subjects, scene, or composition you see
- Colors, light, shapes
- A small, specific detail that makes this image unique
- The mood or emotion the photo captures

Do NOT repeat the caption or notes verbatim. Expand on them with new detail grounded in the image.

Return ONLY the paragraph.`;
}

export function batchRewritePrompt(
  ws: WordStyleKey,
  title: string,
  brief: string,
  dates: string,
  caption: string,
  notes: string,
  previousOutputs: string[],
  len: LengthKey = "standard",
): string {
  const prevCtx = previousOutputs.length > 0
    ? `\nALREADY WRITTEN (avoid similar themes, phrases, or imagery):\n${previousOutputs.map((o, i) => `Photo ${i + 1}: "${o}"`).join("\n")}\n`
    : "";

  const notesField = len === "brief"
    ? `"notes": "" (empty string — Brief length skips the pull quote)`
    : `"notes": "1-2 sentences — what you see and feel in this image"`;
  const paragraphField = len === "brief"
    ? `"paragraph": "1-2 sentences — what's actually in the photo. Minimal."`
    : len === "detailed"
      ? `"paragraph": "2-3 paragraphs (200-300 words total) — richly describe what's in the photo. Use \\n\\n between paragraphs."`
      : `"paragraph": "1 paragraph (80-120 words) — concrete and vivid, describing what's actually in the photo"`;

  return `${systemPrompt(ws, len)}

LOOK AT THE PHOTO ABOVE. Generate caption, notes, and paragraph for THIS specific photo — describe what you actually see.
${prevCtx}
CONTEXT (do not copy):
${tripContext(title, brief, dates)}
Existing caption: "${caption}"
Existing notes: "${notes}"

Write ORIGINAL content grounded in what's visible in the image. Every sentence must connect to what you see in THIS photo.

Return ONLY valid JSON: {"caption": "1 sentence — specific label for what's in this photo", ${notesField}, ${paragraphField}}

JSON only, no markdown.`;
}
