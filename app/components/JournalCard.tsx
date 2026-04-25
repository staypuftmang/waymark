"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import type { JournalSummary } from "@/app/lib/journalStorage";
import { VS, LO } from "@/app/lib/constants";
import type { VisualStyleKey, LayoutKey } from "@/app/lib/types";
import { supabase } from "@/app/lib/supabase";

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildShareUrl(slug: string): string {
  if (typeof window !== "undefined") return `${window.location.origin}/j/${slug}`;
  return `https://mywaymarks.com/j/${slug}`;
}

interface JournalCardProps {
  journal: JournalSummary;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (j: JournalSummary) => void;
  onToast?: (msg: string) => void;
  onShareChanged?: () => void;
}

export default function JournalCard({
  journal,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onToast,
  onShareChanged,
}: JournalCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(journal.title);
  const [shareSlug, setShareSlug] = useState<string | null>(journal.shareSlug);
  const [isPublic, setIsPublic] = useState(journal.isPublic);
  const [shareBusy, setShareBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTitle(journal.title); }, [journal.title]);
  useEffect(() => { setShareSlug(journal.shareSlug); }, [journal.shareSlug]);
  useEffect(() => { setIsPublic(journal.isPublic); }, [journal.isPublic]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const commitRename = () => {
    const trimmed = title.trim();
    if (trimmed !== journal.title) onRename(journal.id, trimmed);
    setRenaming(false);
  };

  const styleLabel = VS[journal.visualStyle as VisualStyleKey]?.label ?? journal.visualStyle;
  const layoutLabel = LO[journal.layout as LayoutKey]?.label ?? journal.layout;
  const modeLabel = journal.mode === "full" ? "Full" : "Quick";

  const callShareApi = async (action: "publish" | "unpublish") => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Not signed in");
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ journalId: journal.id, action }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as { slug: string | null; isPublic: boolean };
  };

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(slug));
      onToast?.("Link copied!");
      track("share_link_copied", { journalId: journal.id });
    } catch {
      onToast?.("Couldn't copy — try again.");
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareSlug) return;
    await copyLink(shareSlug);
  };

  const handleShare = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      const result = await callShareApi("publish");
      setShareSlug(result.slug);
      setIsPublic(result.isPublic);
      track("journal_shared", { journalId: journal.id });
      if (result.slug) await copyLink(result.slug);
      onShareChanged?.();
    } catch (e) {
      console.error("share failed", e);
      onToast?.("Couldn't share — try again.");
    } finally {
      setShareBusy(false);
    }
  };

  const handleMakePrivate = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      const result = await callShareApi("unpublish");
      setIsPublic(result.isPublic);
      track("journal_unshared", { journalId: journal.id });
      onToast?.("Made private");
      onShareChanged?.();
    } catch (e) {
      console.error("unshare failed", e);
      onToast?.("Couldn't update — try again.");
    } finally {
      setShareBusy(false);
    }
  };

  // Build state-aware menu items
  const menuItems: { label: string; run: () => void; accent?: boolean }[] = [
    { label: "Open", run: () => onOpen(journal.id) },
    { label: "Rename", run: () => setRenaming(true) },
    { label: "Duplicate", run: () => onDuplicate(journal.id) },
  ];
  if (isPublic && shareSlug) {
    menuItems.push({ label: "Copy share link", run: () => { void handleCopyShareLink(); } });
    menuItems.push({ label: "Make private", run: () => { void handleMakePrivate(); } });
  } else if (!isPublic && shareSlug) {
    menuItems.push({ label: "Re-share journal", run: () => { void handleShare(); } });
  } else {
    menuItems.push({ label: "Share journal", run: () => { void handleShare(); } });
  }

  return (
    <div
      ref={cardRef}
      onClick={() => { if (!renaming && !menuOpen) onOpen(journal.id); }}
      className="bg-card border border-border"
      style={{
        borderRadius: 6,
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        transition: "box-shadow .2s, transform .2s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: "var(--color-paper)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {journal.coverPhotoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={journal.coverPhotoSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div
            className="font-title"
            style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-warm)", fontSize: 32,
            }}
          >
            W
          </div>
        )}

        {isPublic && shareSlug && (
          <button
            onClick={(e) => { e.stopPropagation(); void handleCopyShareLink(); }}
            title="Public — anyone with the link can view. Click to copy link."
            aria-label="Copy share link"
            className="cursor-pointer"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              fontSize: 11,
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              backdropFilter: "blur(4px)",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.7)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.55)"; }}
          >
            <span aria-hidden style={{ fontSize: 11 }}>{"\u{1F517}"}</span>
            <span>Public</span>
          </button>
        )}
      </div>
      <div style={{ padding: "12px 14px" }}>
        {renaming ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setTitle(journal.title); setRenaming(false); }
            }}
            autoFocus
            style={{
              width: "100%",
              padding: "6px 8px",
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              fontSize: 16,
              fontFamily: "var(--font-title)",
              background: "var(--color-card)",
              outline: "none",
              color: "var(--color-ink)",
            }}
          />
        ) : (
          <div
            className="font-title"
            style={{
              fontSize: 16, fontWeight: 400,
              color: journal.title ? "var(--color-ink)" : "var(--color-warm)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {journal.title || "Untitled Journal"}
          </div>
        )}
        <div className="text-stone" style={{ fontSize: 12, marginTop: 4, textTransform: "capitalize" }}>
          {modeLabel} &middot; {styleLabel} &middot; {layoutLabel}
        </div>
        <div
          className="text-stone"
          style={{
            fontSize: 12, marginTop: 2,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <span>{formatRelativeTime(journal.updatedAt)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="bg-transparent border-none cursor-pointer"
            aria-label="More actions"
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 16,
              color: "var(--color-stone)",
              lineHeight: 1,
            }}
          >
            &middot;&middot;&middot;
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-10 bg-card border border-border"
          style={{
            right: 12,
            bottom: 40,
            borderRadius: 5,
            boxShadow: "0 8px 24px rgba(0,0,0,.12)",
            minWidth: 160,
            overflow: "hidden",
          }}
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => { setMenuOpen(false); item.run(); }}
              className="w-full text-left bg-transparent border-none cursor-pointer"
              style={{ padding: "10px 14px", fontSize: 13, fontFamily: "var(--font-body)", color: "var(--color-ink)" }}
            >
              {item.label}
            </button>
          ))}
          <div style={{ height: 1, background: "var(--color-border)" }} />
          <button
            onClick={() => { setMenuOpen(false); onDelete(journal); }}
            className="w-full text-left bg-transparent border-none cursor-pointer"
            style={{ padding: "10px 14px", fontSize: 13, fontFamily: "var(--font-body)", color: "var(--color-accent)" }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
