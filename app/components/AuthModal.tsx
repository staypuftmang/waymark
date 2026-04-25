"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

interface AuthModalProps {
  open: boolean;
  initialMode?: "signin" | "signup";
  onClose: () => void;
  onAuthed?: () => void;
}

export default function AuthModal({ open, initialMode = "signin", onClose, onAuthed }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Sync the mode with the prop whenever the modal opens — otherwise reopening
  // it after a previous close keeps the stale internal mode.
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setInfo(null);
    }
  }, [open, initialMode]);

  if (!open) return null;

  const reset = () => {
    setError(null);
    setInfo(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Check your email to verify your account.");
        // If email confirmation is disabled in Supabase settings, the user is
        // signed in immediately and onAuthStateChange will fire.
        onAuthed?.();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthed?.();
        onClose();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    reset();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
      setError(msg);
      setBusy(false);
    }
  };

  const forgot = async () => {
    reset();
    if (!email) {
      setError("Enter your email first, then click 'Forgot password?' again.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw error;
      setInfo(`Password reset link sent to ${email}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send reset email.";
      setError(msg);
    } finally {
      setBusy(false);
    }
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
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      style={{ background: "rgba(26,24,21,.6)" }}
      onClick={onClose}
    >
      <div
        className="bg-card"
        style={{
          borderRadius: 6,
          padding: "32px 28px",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 16px 48px rgba(0,0,0,.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="font-title text-center"
          style={{ fontSize: 24, fontWeight: 300, color: "var(--color-ink)", marginBottom: 6 }}
        >
          {mode === "signin" ? "Sign in to Waymark" : "Create your Waymark account"}
        </div>
        <div className="text-stone text-center" style={{ fontSize: 12, marginBottom: 22 }}>
          {mode === "signin" ? "Welcome back." : "Save journals across devices."}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-2">
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          {error && (
            <div style={{ fontSize: 12, color: "var(--color-accent)", marginTop: 4 }}>{error}</div>
          )}
          {info && (
            <div style={{ fontSize: 12, color: "var(--color-stone)", marginTop: 4 }}>{info}</div>
          )}
          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 10,
              padding: "12px 18px",
              border: "none",
              borderRadius: 5,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "var(--font-body)",
              cursor: busy ? "wait" : "pointer",
              background: "var(--color-accent)",
              color: "#fff",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <div
          className="flex items-center"
          style={{ margin: "20px 0 14px", gap: 8, fontSize: 11, color: "var(--color-warm)" }}
        >
          <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
          <span>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
        </div>

        <button
          onClick={google}
          disabled={busy}
          style={{
            width: "100%",
            padding: "10px 14px",
            border: "1px solid var(--color-border)",
            borderRadius: 5,
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "var(--font-body)",
            cursor: busy ? "wait" : "pointer",
            background: "#fff",
            color: "var(--color-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.6-5.3l-6.3-5.2C29.3 34.9 26.8 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l.1.1 6.3 5.2C37.1 41 44 35 44 24c0-1.2-.1-2.3-.4-3.5z" />
          </svg>
          Continue with Google
        </button>

        <div className="text-center" style={{ marginTop: 18, fontSize: 12, color: "var(--color-stone)" }}>
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => { setMode("signup"); reset(); }}
                className="bg-transparent border-none cursor-pointer"
                style={{ color: "var(--color-accent)", fontSize: 12, padding: 0 }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("signin"); reset(); }}
                className="bg-transparent border-none cursor-pointer"
                style={{ color: "var(--color-accent)", fontSize: 12, padding: 0 }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
        {mode === "signin" && (
          <div className="text-center" style={{ marginTop: 8, fontSize: 12 }}>
            <button
              onClick={forgot}
              className="bg-transparent border-none cursor-pointer"
              style={{ color: "var(--color-stone)", fontSize: 12, padding: 0 }}
            >
              Forgot password?
            </button>
          </div>
        )}

        <div className="text-center" style={{ marginTop: 16 }}>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer"
            style={{ color: "var(--color-warm)", fontSize: 11, padding: 0 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
