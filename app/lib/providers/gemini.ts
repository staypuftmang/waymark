import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.0-flash";

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (_client) return _client;
  const key = process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "Missing GOOGLE_GEMINI_API_KEY — set it in .env.local (and Vercel) to enable the Gemini fallback.",
    );
  }
  _client = new GoogleGenerativeAI(key);
  return _client;
}

interface InlinePart {
  inlineData: { data: string; mimeType: string };
}

interface TextPart {
  text: string;
}

type Part = InlinePart | TextPart;

interface DataUrlParts {
  data: string;
  mimeType: string;
}

function parseDataUrl(image: string): DataUrlParts | null {
  const commaIdx = image.indexOf(",");
  if (commaIdx < 0) return null;
  const header = image.slice(0, commaIdx);
  const data = image.slice(commaIdx + 1);
  const m = header.match(/data:([^;]+)/);
  return { mimeType: m ? m[1] : "image/jpeg", data };
}

// Gemini's vision API doesn't dereference arbitrary external URLs the way
// Anthropic's URL image source does — it accepts inlineData (base64) or
// fileData (Google Files API URI). Our Storage signed URLs are neither,
// so we fetch the bytes server-side and inline them.
async function fetchAsBase64(url: string): Promise<DataUrlParts> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch image (${r.status}) at ${url}`);
  const ct = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
  const buf = Buffer.from(await r.arrayBuffer());
  return { mimeType: ct, data: buf.toString("base64") };
}

async function imageToInline(image: string): Promise<InlinePart | null> {
  if (!image) return null;
  if (image.startsWith("data:")) {
    const p = parseDataUrl(image);
    return p ? { inlineData: { data: p.data, mimeType: p.mimeType } } : null;
  }
  if (image.startsWith("http://") || image.startsWith("https://")) {
    const p = await fetchAsBase64(image);
    return { inlineData: { data: p.data, mimeType: p.mimeType } };
  }
  return null;
}

export interface GeminiCallParams {
  prompt: string;
  image?: string;
  images?: string[];
  maxTokens?: number;
}

/**
 * Call Gemini 2.0 Flash with the same prompt + photos as the Anthropic
 * call would receive. Anthropic's `messages: [{ role: "user", content }]`
 * payload — text + images interleaved in a single user message — maps to
 * Gemini's `contents: [{ role: "user", parts }]`. There is no separate
 * system instruction in Waymark's prompts (the prompt builders in
 * prompts.ts produce one self-contained user message), so no
 * systemInstruction field is set.
 */
export async function geminiCall(params: GeminiCallParams): Promise<string> {
  const { prompt, image, images, maxTokens = 1000 } = params;
  const model = getClient().getGenerativeModel({ model: MODEL });

  const imgs = Array.isArray(images) && images.length > 0 ? images : image ? [image] : [];
  const parts: Part[] = [];
  for (const i of imgs) {
    const inline = await imageToInline(i);
    if (inline) parts.push(inline);
  }
  parts.push({ text: prompt });

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: { maxOutputTokens: maxTokens },
  });
  return result.response.text().trim();
}

export const GEMINI_MODEL = MODEL;
