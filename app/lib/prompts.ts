import { WordStyleKey } from "./types";
import { WS } from "./constants";

const BANNED_PHRASES = [
  "breathtaking views", "breathtaking scenery", "breathtaking",
  "hidden gem", "feast for the senses", "time stood still",
  "memories that will last a lifetime", "the journey is the destination",
  "off the beaten path", "a world away", "melting pot of cultures",
  "picture-perfect", "steeped in history", "bustling streets",
];

function systemPrompt(ws: WordStyleKey): string {
  return `You are writing entries for a personal travel journal.

${WS[ws].sys}

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
  previousCaptions: string[]
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

  return `${systemPrompt(ws)}

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
{"caption": "1 short sentence — a specific label for what's in THIS photo, starting with a unique word", "notes": "1-2 sentences — what you see and feel about THIS specific moment, with ${aspect}", "paragraph": "3-5 sentences — bring THIS specific photo to life with concrete ${aspect} details. Describe what's actually visible. No clichés."}

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
  previousOutputs: string[]
): string {
  const prevCtx = previousOutputs.length > 0
    ? `\nALREADY WRITTEN (avoid similar themes, phrases, or imagery):\n${previousOutputs.map((o, i) => `Photo ${i + 1}: "${o}"`).join("\n")}\n`
    : "";

  return `${systemPrompt(ws)}

LOOK AT THE PHOTO ABOVE. Generate caption, notes, and paragraph for THIS specific photo — describe what you actually see.
${prevCtx}
CONTEXT (do not copy):
${tripContext(title, brief, dates)}
Existing caption: "${caption}"
Existing notes: "${notes}"

Write ORIGINAL content grounded in what's visible in the image. Every sentence must connect to what you see in THIS photo.

Return ONLY valid JSON: {"caption": "1 sentence — specific label for what's in this photo", "notes": "1-2 sentences — what you see and feel in this image", "paragraph": "3-5 sentences — concrete and vivid, describing what's actually in the photo"}

JSON only, no markdown.`;
}
