"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Phase = "loading" | "form" | "saving" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Step 1 — turn whatever Supabase put in the URL into a usable session.
  // PKCE flow: ?code=… (we exchange it). Implicit flow: #access_token=…
  // &type=recovery (the supabase client auto-handles on init via
  // detectSessionInUrl). Either way, by the time we read the session it
  // should be present if the link was valid.
  useEffect(() => {
    const proceed = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError("This reset link is invalid or has expired.");
          setPhase("error");
          return;
        }
        // Strip the code from the URL so refresh doesn't double-exchange.
        window.history.replaceState({}, "", window.location.pathname);
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setPhase("form");
      } else {
        setError("This reset link is invalid or has expired.");
        setPhase("error");
      }
    };
    proceed();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don\u2019t match.");
      return;
    }
    setPhase("saving");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setPhase("form");
      return;
    }
    setPhase("success");
    setTimeout(() => router.push("/"), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid var(--color-border)",
    borderRadius: 5,
    fontSize: 16,
    fontFamily: "var(--font-body)",
    background: "var(--color-card)",
    outline: "none",
    color: "var(--color-ink)",
  };

  return (
    <div className="min-h-screen bg-paper font-body flex items-center justify-center" style={{ padding: "24px" }}>
      <div
        className="bg-card"
        style={{
          borderRadius: 6,
          padding: "32px 28px",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 16px 48px rgba(0,0,0,.12)",
        }}
      >
        <div
          className="font-title text-center"
          style={{ fontSize: 24, fontWeight: 300, color: "var(--color-ink)", marginBottom: 6 }}
        >
          {phase === "success" ? "Password updated!" : "Set a new password"}
        </div>

        {phase === "loading" && (
          <div className="text-stone text-center" style={{ fontSize: 13, marginTop: 16 }}>
            Verifying your reset link\u2026
          </div>
        )}

        {phase === "error" && (
          <>
            <div className="text-stone text-center" style={{ fontSize: 13, marginTop: 16, lineHeight: 1.6 }}>
              {error}
            </div>
            <button
              onClick={() => router.push("/")}
              className="border-none cursor-pointer font-body"
              style={{
                marginTop: 24,
                width: "100%",
                padding: "12px 18px",
                borderRadius: 5,
                fontSize: 14,
                fontWeight: 600,
                background: "var(--color-accent)",
                color: "#fff",
              }}
            >
              Back to Waymark
            </button>
          </>
        )}

        {phase === "success" && (
          <div className="text-stone text-center" style={{ fontSize: 13, marginTop: 16 }}>
            Redirecting you back to Waymark\u2026
          </div>
        )}

        {(phase === "form" || phase === "saving") && (
          <>
            <div className="text-stone text-center" style={{ fontSize: 12, marginBottom: 22 }}>
              Choose something you\u2019ll remember.
            </div>
            <form onSubmit={submit} className="flex flex-col gap-2">
              <input
                type="password"
                placeholder="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                disabled={phase === "saving"}
              />
              <input
                type="password"
                placeholder="Confirm password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={inputStyle}
                disabled={phase === "saving"}
              />
              {error && (
                <div style={{ fontSize: 12, color: "var(--color-accent)", marginTop: 4 }}>{error}</div>
              )}
              <button
                type="submit"
                disabled={phase === "saving"}
                className="border-none cursor-pointer font-body"
                style={{
                  marginTop: 10,
                  padding: "12px 18px",
                  borderRadius: 5,
                  fontSize: 14,
                  fontWeight: 600,
                  background: "var(--color-accent)",
                  color: "#fff",
                  cursor: phase === "saving" ? "wait" : "pointer",
                  opacity: phase === "saving" ? 0.7 : 1,
                }}
              >
                {phase === "saving" ? "\u2026" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
