"use client";

import { useEffect, useRef, useState } from "react";
import type { JournalSummary } from "@/app/lib/journalStorage";
import { VS, LO } from "@/app/lib/constants";
import type { VisualStyleKey, LayoutKey } from "@/app/lib/types";

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

interface JournalCardProps {
  journal: JournalSummary;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (j: JournalSummary) => void;
}

export default function JournalCard({ journal, onOpen, onRename, onDuplicate, onDelete }: JournalCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(journal.title);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTitle(journal.title); }, [journal.title]);

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
          {modeLabel} · {styleLabel} · {layoutLabel}
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
            minWidth: 140,
            overflow: "hidden",
          }}
        >
          {[
            { label: "Open", run: () => onOpen(journal.id) },
            { label: "Rename", run: () => setRenaming(true) },
            { label: "Duplicate", run: () => onDuplicate(journal.id) },
          ].map((item) => (
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
