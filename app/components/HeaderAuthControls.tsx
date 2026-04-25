"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/lib/AuthContext";

interface HeaderAuthControlsProps {
  onSignInClick: () => void;
  onSignUpClick: () => void;
  onYourJournals?: () => void;
}

export default function HeaderAuthControls({
  onSignInClick,
  onSignUpClick,
  onYourJournals,
}: HeaderAuthControlsProps) {
  const { user, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="flex items-center" style={{ gap: 10 }}>
        <button
          onClick={onSignInClick}
          className="bg-transparent border-none cursor-pointer font-body"
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-warm)",
            padding: "6px 4px",
          }}
        >
          Sign in
        </button>
        <button
          onClick={onSignUpClick}
          className="border-none cursor-pointer font-body"
          style={{
            fontSize: 12,
            fontWeight: 600,
            background: "var(--color-accent)",
            color: "#fff",
            padding: "8px 14px",
            borderRadius: 4,
          }}
        >
          Start free
        </button>
      </div>
    );
  }

  const initial = (user.email?.[0] ?? "U").toUpperCase();
  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email ||
    "";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="border-none cursor-pointer flex items-center justify-center font-body"
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          background: "var(--color-paper)",
          color: "var(--color-ink)",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {initial}
      </button>
      {open && (
        <div
          className="absolute bg-card border border-border"
          style={{
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 220,
            borderRadius: 5,
            boxShadow: "0 8px 24px rgba(0,0,0,.18)",
            overflow: "hidden",
            zIndex: 200,
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--color-border)" }}>
            <div className="font-body" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
              {name}
            </div>
            <div className="text-stone" style={{ fontSize: 11, marginTop: 2, wordBreak: "break-all" }}>
              {user.email}
            </div>
          </div>
          {onYourJournals && (
            <button
              onClick={() => { setOpen(false); onYourJournals(); }}
              className="w-full text-left bg-transparent border-none cursor-pointer font-body"
              style={{ padding: "10px 14px", fontSize: 13, color: "var(--color-ink)" }}
            >
              Your Journals
            </button>
          )}
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full text-left bg-transparent border-none cursor-pointer font-body"
            style={{ padding: "10px 14px", fontSize: 13, color: "var(--color-ink)", borderTop: "1px solid var(--color-border)" }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
