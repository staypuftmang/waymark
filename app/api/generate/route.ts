import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PRIMARY_MODEL = "claude-sonnet-4-20250514";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";

export async function POST(req: Request) {
  const { prompt, maxTokens = 1000 } = await req.json();

  // Try primary model first
  try {
    const message = await client.messages.create({
      model: PRIMARY_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return Response.json({ text, model: PRIMARY_MODEL });
  } catch (e: unknown) {
    const status = (e as { status?: number }).status;

    // If overloaded (529) or rate limited (429), fall back to Haiku
    if (status === 529 || status === 429) {
      console.warn(`Primary model ${PRIMARY_MODEL} unavailable (${status}), falling back to ${FALLBACK_MODEL}`);

      try {
        const message = await client.messages.create({
          model: FALLBACK_MODEL,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        });

        const text = message.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();

        return Response.json({ text, model: FALLBACK_MODEL, fallback: true });
      } catch (fallbackErr) {
        console.error("Fallback model also failed:", fallbackErr);
        return Response.json({ text: "", error: "Both models unavailable", fallback: true }, { status: 503 });
      }
    }

    console.error("API generate error:", e);
    return Response.json({ text: "", error: "Generation failed" }, { status: 500 });
  }
}
