import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const { prompt, maxTokens = 1000 } = await req.json();

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return Response.json({ text });
  } catch (e) {
    console.error("API generate error:", e);
    return Response.json({ text: "", error: "Generation failed" }, { status: 500 });
  }
}
