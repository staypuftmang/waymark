"use client";

import { useEffect, useState } from "react";
import { getJournalStats, type JournalViewStats } from "@/app/lib/journalStorage";

interface JournalStatsModalProps {
  journalId: string;
  journalTitle: string;
  onClose: () => void;
}

export default function JournalStatsModal({
  journalId,
  journalTitle,
  onClose,
}: JournalStatsModalProps) {
  const [stats, setStats] = useState<JournalViewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getJournalStats(journalId).then((s) => {
      if (!cancelled) {
        setStats(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [journalId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border"
        style={{
          borderRadius: 8,
          padding: "20px 24px",
          maxWidth: 480,
          width: "calc(100% - 32px)",
          maxHeight: "calc(100vh - 64px)",
          overflowY: "auto",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div className="font-title" style={{ fontSize: 18, color: "var(--color-ink)" }}>
              {journalTitle || "Untitled Journal"}
            </div>
            <div className="text-stone" style={{ fontSize: 12, marginTop: 2, fontFamily: "var(--font-body)" }}>
              View statistics
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-none cursor-pointer"
            style={{ padding: 4, fontSize: 18, color: "var(--color-stone)", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-stone" style={{ fontSize: 13, fontFamily: "var(--font-body)", padding: "24px 0" }}>
            Loading…
          </div>
        ) : stats ? (
          <>
            <SummaryRow stats={stats} />
            <Section title="Top referrers" rows={stats.topReferrers.map((r) => ({ label: r.host, count: r.count }))} />
            <Section title="Top countries" rows={stats.topCountries.map((r) => ({ label: r.country, count: r.count }))} />
            {stats.total === 0 && (
              <div className="text-stone" style={{ fontSize: 13, fontFamily: "var(--font-body)", marginTop: 8 }}>
                No views yet. Share the link to start collecting stats.
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function SummaryRow({ stats }: { stats: JournalViewStats }) {
  return (
    <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
      <Metric label="Total views" value={stats.total} />
      <Metric label="This week" value={stats.lastWeek} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-title" style={{ fontSize: 28, color: "var(--color-ink)", lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div className="text-stone" style={{ fontSize: 11, fontFamily: "var(--font-body)", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

interface SectionRow {
  label: string;
  count: number;
}

function Section({ title, rows }: { title: string; rows: SectionRow[] }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        className="text-stone"
        style={{
          fontSize: 11,
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                fontSize: 12,
                fontFamily: "var(--font-body)",
                color: "var(--color-ink)",
                width: 120,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={r.label}
            >
              {r.label}
            </div>
            <div style={{ flex: 1, height: 6, background: "var(--color-paper)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.round((r.count / max) * 100)}%`,
                  height: "100%",
                  background: "var(--color-stone)",
                  borderRadius: 3,
                }}
              />
            </div>
            <div
              className="text-stone"
              style={{ fontSize: 12, fontFamily: "var(--font-body)", width: 32, textAlign: "right" }}
            >
              {r.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
