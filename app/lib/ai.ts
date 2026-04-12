export async function aiCall(prompt: string): Promise<string> {
  try {
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, maxTokens: 1000 }),
    });
    const d = await r.json();
    return d.text || "";
  } catch {
    return "";
  }
}
