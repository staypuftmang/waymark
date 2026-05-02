import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// vi.hoisted() lets us declare mock state that's available BOTH inside the
// vi.mock() factory (which is hoisted above imports) and inside the tests.
// ─────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  return {
    // Anthropic
    messagesCreate: vi.fn(),
    // Supabase auth
    getUser: vi.fn(),
    // Rate limit module
    checkUserRateLimit: vi.fn(),
    checkJournalCreationLimit: vi.fn(),
    checkJournalRewriteLimit: vi.fn(),
    recordUsage: vi.fn(),
    maybeCleanup: vi.fn(),
    // Provider fallback
    geminiCall: vi.fn(),
    recordProviderSuccess: vi.fn(),
    recordProviderFailure: vi.fn(),
  };
});

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class Anthropic {
      messages = { create: mocks.messagesCreate };
    },
  };
});

vi.mock("@/app/lib/supabase-admin", () => ({
  supabaseAdmin: {
    auth: { getUser: mocks.getUser },
  },
}));

vi.mock("@/app/lib/rateLimit", () => ({
  checkUserRateLimit: mocks.checkUserRateLimit,
  checkJournalCreationLimit: mocks.checkJournalCreationLimit,
  checkJournalRewriteLimit: mocks.checkJournalRewriteLimit,
  recordUsage: mocks.recordUsage,
  maybeCleanup: mocks.maybeCleanup,
  HOURLY_LIMIT: 50,
  DAILY_LIMIT: 200,
}));

vi.mock("@/app/lib/providers/gemini", () => ({
  geminiCall: mocks.geminiCall,
  GEMINI_MODEL: "gemini-2.0-flash",
}));

vi.mock("@/app/lib/providers/state", () => ({
  recordProviderSuccess: mocks.recordProviderSuccess,
  recordProviderFailure: mocks.recordProviderFailure,
}));

// Now import the route under test.
import { POST } from "@/app/api/generate/route";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("https://test.local/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function authHeaders(token = "valid-token") {
  return { authorization: `Bearer ${token}` };
}

function defaultRateLimitMocks(userId = "user-1") {
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mocks.checkUserRateLimit.mockResolvedValue({
    allowed: true,
    hourlyRemaining: 49,
    dailyRemaining: 199,
  });
  mocks.checkJournalCreationLimit.mockResolvedValue({
    allowed: true,
    used: 0,
    remaining: 10,
    resetInSeconds: 3600,
  });
  mocks.checkJournalRewriteLimit.mockResolvedValue({
    allowed: true,
    used: 0,
    remaining: 30,
    cooldownActive: false,
    cooldownResetInSeconds: 0,
  });
  mocks.recordUsage.mockResolvedValue(undefined);
  mocks.maybeCleanup.mockReturnValue(undefined);
  mocks.messagesCreate.mockResolvedValue({
    content: [{ type: "text", text: "AI output" }],
  });
  // Default Gemini mock — used by tests that exercise the Anthropic →
  // Gemini fallback. Tests that want both providers to fail override
  // this with mockRejectedValue.
  mocks.geminiCall.mockResolvedValue("Gemini output");
}

beforeEach(() => {
  defaultRateLimitMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth header parsing
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/generate — auth header", () => {
  it("extracts the user id from a Bearer token", async () => {
    const req = makeRequest(
      { prompt: "hello", actionType: "rewrite_single" },
      authHeaders("token-xyz"),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.getUser).toHaveBeenCalledWith("token-xyz");
    // recordUsage should be called with the resolved user id
    expect(mocks.recordUsage).toHaveBeenCalledWith("user-1", "rewrite_single", null, "anthropic");
  });

  it("treats requests without a Bearer token as anonymous (IP rate limit path)", async () => {
    const req = makeRequest({ prompt: "hello", actionType: "rewrite_single" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // Anon path skips the user-bound rate-limit checks entirely.
    expect(mocks.checkUserRateLimit).not.toHaveBeenCalled();
    expect(mocks.recordUsage).not.toHaveBeenCalled();
  });

  it("treats invalid Bearer tokens (Supabase returns null user) as anonymous", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const req = makeRequest(
      { prompt: "hello", actionType: "rewrite_single" },
      authHeaders("garbage"),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.checkUserRateLimit).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limit branches
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/generate — rate limits", () => {
  it("returns 429 with the umbrella shape when checkUserRateLimit blocks", async () => {
    mocks.checkUserRateLimit.mockResolvedValue({
      allowed: false,
      limitType: "daily",
      resetInSeconds: 3600,
      hourlyRemaining: 0,
      dailyRemaining: 0,
    });
    const req = makeRequest(
      { prompt: "hi", actionType: "rewrite_single" },
      authHeaders(),
    );
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
    expect(body.limit_type).toBe("daily");
    expect(body.signed_in).toBe(true);
    expect(body.message).toMatch(/Daily/);
  });

  it("returns 429 when the daily journal-creation cap is hit", async () => {
    mocks.checkJournalCreationLimit.mockResolvedValue({
      allowed: false,
      used: 10,
      remaining: 0,
      resetInSeconds: 3600,
    });
    const req = makeRequest(
      { prompt: "hi", actionType: "journal_created" },
      authHeaders(),
    );
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.limit_type).toBe("journal_creation");
    expect(body.journals_used).toBe(10);
    expect(body.journals_remaining).toBe(0);
  });

  it("returns 429 with limit_type=journal_rewrites when the per-journal cap is hit", async () => {
    mocks.checkJournalRewriteLimit.mockResolvedValue({
      allowed: false,
      reason: "cap",
      used: 30,
      remaining: 0,
    });
    const req = makeRequest(
      { prompt: "hi", actionType: "rewrite_single", journalId: "j-123" },
      authHeaders(),
    );
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.limit_type).toBe("journal_rewrites");
    expect(body.journal_rewrites_used).toBe(30);
  });

  it("returns 429 with limit_type=cooldown when the per-journal cooldown is active", async () => {
    mocks.checkJournalRewriteLimit.mockResolvedValue({
      allowed: false,
      reason: "cooldown",
      used: 5,
      remaining: 25,
      cooldownResetInSeconds: 30,
    });
    const req = makeRequest(
      { prompt: "hi", actionType: "rewrite_single", journalId: "j-123" },
      authHeaders(),
    );
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.limit_type).toBe("cooldown");
    expect(body.cooldown_remaining_seconds).toBe(30);
  });

  it("falls back to IP rate limiting when no auth header is present (unique IP allowed)", async () => {
    const req = makeRequest(
      { prompt: "hi", actionType: "rewrite_single" },
      { "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 200)}` },
    );
    const res = await POST(req);
    // First request from this IP should pass — and the route should NOT
    // consult the user-bound rate-limit module at all.
    expect(res.status).toBe(200);
    expect(mocks.checkUserRateLimit).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Action types + recording
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/generate — action types", () => {
  const validActions = [
    "journal_created",
    "rewrite_single",
    "rewrite_batch_photo",
    "trip_brief_generate",
  ] as const;

  for (const action of validActions) {
    it(`accepts actionType=${action} and records it`, async () => {
      const req = makeRequest({ prompt: "hi", actionType: action }, authHeaders());
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mocks.recordUsage).toHaveBeenCalledWith("user-1", action, null, "anthropic");
    });
  }

  it("falls back to 'rewrite_single' when actionType is unknown", async () => {
    const req = makeRequest(
      { prompt: "hi", actionType: "made-up-action" },
      authHeaders(),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.recordUsage).toHaveBeenCalledWith("user-1", "rewrite_single", null, "anthropic");
  });

  it("does NOT record usage when record:false is passed", async () => {
    const req = makeRequest(
      { prompt: "hi", actionType: "rewrite_single", record: false },
      authHeaders(),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.recordUsage).not.toHaveBeenCalled();
  });

  it("forwards the journalId to recordUsage", async () => {
    const req = makeRequest(
      { prompt: "hi", actionType: "rewrite_single", journalId: "j-42" },
      authHeaders(),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.recordUsage).toHaveBeenCalledWith("user-1", "rewrite_single", "j-42", "anthropic");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic call + error handling
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/generate — Anthropic interaction", () => {
  it("returns the model text on success", async () => {
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Hello world" }],
    });
    const req = makeRequest(
      { prompt: "say hi", actionType: "rewrite_single" },
      authHeaders(),
    );
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.text).toBe("Hello world");
    expect(body.model).toBe("claude-sonnet-4-20250514");
    expect(body.fallback).toBeUndefined();
  });

  it("falls back to the secondary model on a 529 from primary", async () => {
    mocks.messagesCreate
      .mockRejectedValueOnce(Object.assign(new Error("overloaded"), { status: 529 }))
      .mockResolvedValueOnce({ content: [{ type: "text", text: "Fallback text" }] });
    const req = makeRequest(
      { prompt: "x", actionType: "rewrite_single" },
      authHeaders(),
    );
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.text).toBe("Fallback text");
    expect(body.model).toBe("claude-haiku-4-5-20251001");
    expect(body.fallback).toBe(true);
  });

  it("falls back to Gemini when Anthropic 5xx and tags response with provider=google", async () => {
    mocks.messagesCreate.mockRejectedValue(
      Object.assign(new Error("internal"), { status: 500 }),
    );
    mocks.geminiCall.mockResolvedValue("From Gemini");
    const req = makeRequest(
      { prompt: "x", actionType: "rewrite_single" },
      authHeaders(),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-provider")).toBe("google");
    const body = await res.json();
    expect(body.text).toBe("From Gemini");
    expect(body.provider).toBe("google");
    expect(body.model).toBe("gemini-2.0-flash");
    expect(body.fallback).toBe(true);
    // Anthropic was marked degraded, with Gemini as the rescuer.
    expect(mocks.recordProviderFailure).toHaveBeenCalledWith(
      "anthropic", expect.any(String), "google",
    );
    // Usage row should attribute the call to google.
    expect(mocks.recordUsage).toHaveBeenCalledWith(
      "user-1", "rewrite_single", null, "google",
    );
  });

  it("returns 503 ai_unavailable when both Anthropic AND Gemini fail", async () => {
    mocks.messagesCreate.mockRejectedValue(
      Object.assign(new Error("internal"), { status: 500 }),
    );
    mocks.geminiCall.mockRejectedValue(new Error("Gemini exploded"));
    const req = makeRequest(
      { prompt: "x", actionType: "rewrite_single" },
      authHeaders(),
    );
    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("ai_unavailable");
    expect(body.message).toMatch(/temporarily unavailable/i);
    // No usage row should be recorded when no provider served the request.
    expect(mocks.recordUsage).not.toHaveBeenCalled();
    // Both providers should be marked degraded with no rescuer.
    expect(mocks.recordProviderFailure).toHaveBeenCalledWith(
      "anthropic", expect.any(String), null,
    );
    expect(mocks.recordProviderFailure).toHaveBeenCalledWith(
      "google", expect.any(String), null,
    );
  });

  it("does NOT fall back to Gemini on a 4xx Anthropic error", async () => {
    // 400-class errors mean the request shape is wrong — Gemini would
    // reproduce the same failure. Surface the legacy 500 instead.
    mocks.messagesCreate.mockRejectedValue(
      Object.assign(new Error("bad request"), { status: 400 }),
    );
    const req = makeRequest(
      { prompt: "x", actionType: "rewrite_single" },
      authHeaders(),
    );
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(mocks.geminiCall).not.toHaveBeenCalled();
    expect(mocks.recordUsage).not.toHaveBeenCalled();
  });

  it("records provider success on a healthy Anthropic call (closes the recovery loop)", async () => {
    const req = makeRequest(
      { prompt: "x", actionType: "rewrite_single" },
      authHeaders(),
    );
    await POST(req);
    expect(mocks.recordProviderSuccess).toHaveBeenCalledWith("anthropic");
  });

  it("filters non-text content blocks from the response", async () => {
    mocks.messagesCreate.mockResolvedValue({
      content: [
        { type: "text", text: "first " },
        { type: "image", source: { type: "base64", data: "x" } },
        { type: "text", text: "second" },
      ],
    });
    const req = makeRequest(
      { prompt: "x", actionType: "rewrite_single" },
      authHeaders(),
    );
    const res = await POST(req);
    const body = await res.json();
    expect(body.text).toBe("first second");
  });
});
