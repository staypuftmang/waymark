"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { supabase } from "@/app/lib/supabase";

interface SharePanelProps {
  journalId: string;
  initialSlug: string | null;
  initialIsPublic: boolean;
  onClose: () => void;
  onChange: (slug: string | null, isPublic: boolean) => void;
  onToast: (msg: string) => void;
  bg: string;
  fg: string;
  accent: string;
}

function buildShareUrl(slug: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/j/${slug}`;
  }
  return `https://mywaymarks.com/j/${slug}`;
}

export default function SharePanel({
  journalId,
  initialSlug,
  initialIsPublic,
  onClose,
  onChange,
  onToast,
  bg,
  fg,
  accent,
}: SharePanelProps) {
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const callApi = async (action: "publish" | "unpublish") => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Not signed in");
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ journalId, action }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as { slug: string | null; isPublic: boolean };
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast("Link copied!");
    } catch {
      onToast("Couldn't copy — select the link to copy.");
    }
  };

  const onMakePublic = async () => {
    setBusy(true);
    try {
      const result = await callApi("publish");
      setSlug(result.slug);
      setIsPublic(result.isPublic);
      onChange(result.slug, result.isPublic);
      track("journal_shared", { journalId });
      if (result.slug) {
        await copyToClipboard(buildShareUrl(result.slug));
        track("share_link_copied", { journalId });
      }
    } catch (e) {
      console.error("share failed", e);
      onToast("Couldn't share — try again.");
    } finally {
      setBusy(false);
    }
  };

  const onMakePrivate = async () => {
    setBusy(true);
    try {
      const result = await callApi("unpublish");
      setIsPublic(result.isPublic);
      onChange(result.slug ?? slug, result.isPublic);
      track("journal_unshared", { journalId });
    } catch (e) {
      console.error("unshare failed", e);
      onToast("Couldn't update — try again.");
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    if (!slug) return;
    await copyToClipboard(buildShareUrl(slug));
    track("share_link_copied", { journalId });
  };

  const showShared = isPublic && !!slug;

  return (
    <div
      ref={panelRef}
      className="absolute z-[200]"
      style={{
        top: "calc(100% + 6px)",
        right: 0,
        background: bg,
        color: fg,
        border: `1px solid ${fg}22`,
        borderRadius: 4,
        boxShadow: "0 8px 24px rgba(0,0,0,.18)",
        width: 320,
        padding: 18,
        fontFamily: "var(--font-body)",
      }}
    >
      {!showShared ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Share this journal</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.75, marginBottom: 14 }}>
            Anyone with the link will be able to view your journal. You can turn this off anytime.
          </div>
          <button
            onClick={onMakePublic}
            disabled={busy}
            className="border-none cursor-pointer font-body"
            style={{
              width: "100%",
              padding: "10px 14px",
              background: accent,
              color: "#fff",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              opacity: busy ? 0.6 : 1,
              marginBottom: 8,
            }}
          >
            {busy ? "Working…" : "Make public & copy link"}
          </button>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer font-body"
            style={{ fontSize: 11, color: fg, opacity: 0.6, padding: "4px 0" }}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Share link</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid ${fg}22`,
              borderRadius: 4,
              padding: "6px 8px",
              marginBottom: 10,
              background: `${fg}06`,
            }}
          >
            <input
              readOnly
              value={buildShareUrl(slug!)}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 11,
                color: fg,
                fontFamily: "var(--font-body)",
              }}
            />
            <button
              onClick={onCopy}
              className="border-none cursor-pointer"
              title="Copy link"
              style={{
                background: "transparent",
                color: fg,
                fontSize: 13,
                padding: "2px 6px",
                borderRadius: 3,
              }}
            >
              {"📋"}
            </button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 12 }}>
            <span style={{ color: "#16a34a" }}>{"●"}</span>{" "}
            <span>Public &mdash; anyone with link can view</span>
          </div>
          <button
            onClick={onMakePrivate}
            disabled={busy}
            className="bg-transparent border-none cursor-pointer font-body"
            style={{ fontSize: 12, color: fg, textDecoration: "underline", opacity: busy ? 0.6 : 0.85, padding: 0 }}
          >
            {busy ? "Working…" : "Make private"}
          </button>
        </>
      )}
    </div>
  );
}
