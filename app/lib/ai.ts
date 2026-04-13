export interface AiResult {
  text: string;
  fallback?: boolean;
}

let onFallbackUsed: (() => void) | null = null;

/** Register a callback that fires when the fallback model is used */
export function setFallbackListener(fn: (() => void) | null) {
  onFallbackUsed = fn;
}

export async function aiCall(prompt: string): Promise<string> {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, maxTokens: 1000 }),
      });

      if (!r.ok) {
        console.warn(`AI call failed (attempt ${attempt + 1}): status ${r.status}`);
        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
          continue;
        }
        return "";
      }

      const d: AiResult = await r.json();

      if (d.fallback && onFallbackUsed) {
        onFallbackUsed();
      }

      return d.text || "";
    } catch (e) {
      console.warn(`AI call error (attempt ${attempt + 1}):`, e);
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
        continue;
      }
      return "";
    }
  }

  return "";
}
