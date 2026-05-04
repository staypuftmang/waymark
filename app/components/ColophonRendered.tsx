"use client";

import type { Colophon } from "@/app/lib/types";

interface ColophonRenderedProps {
  colophon: Colophon | null;
}

/**
 * Closing-page section for the journal. Dark background, ivory text,
 * gold accents — feels like the colophon page in a printed travel book.
 * Rendered at the end of JournalPreview and PublicJournalView.
 *
 * Hidden entirely when the colophon is null or disabled. Items with
 * visible: false are filtered out before rendering. Sorted by `order`.
 *
 * Bottom carries a low-opacity "Made with Waymark" footer per spec.
 */
export default function ColophonRendered({ colophon }: ColophonRenderedProps) {
  if (!colophon || !colophon.enabled) return null;
  const items = [...colophon.items]
    .filter((it) => it.visible)
    .sort((a, b) => a.order - b.order);
  // If the colophon is enabled but the user has cleared everything, render
  // nothing — an empty dark section reads as a bug.
  const hasContent =
    !!colophon.pullQuote.trim() || !!colophon.closingLine.trim() || items.length > 0;
  if (!hasContent) return null;

  const goldRule: React.CSSProperties = {
    width: 40,
    height: 1,
    background: "#C4A45A",
    margin: "32px auto",
    border: "none",
  };

  return (
    <section
      data-export-colophon
      style={{
        background: "#1C1C1C",
        color: "#F8F5F0",
        padding: "72px 24px",
        marginTop: 48,
      }}
    >
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div
          style={{
            textAlign: "center",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#C4A45A",
            marginBottom: 32,
            fontFamily: "var(--font-body)",
          }}
        >
          Trip details
        </div>

        {colophon.pullQuote.trim() && (
          <>
            <blockquote
              style={{
                fontFamily: "var(--font-title)",
                fontSize: 22,
                fontWeight: 300,
                lineHeight: 1.5,
                textAlign: "center",
                color: "#F8F5F0",
                margin: 0,
                padding: "0 16px",
                fontStyle: "italic",
              }}
            >
              &ldquo;{colophon.pullQuote.trim()}&rdquo;
            </blockquote>
            <hr style={goldRule} />
          </>
        )}

        {items.length > 0 && (
          <>
            <dl
              style={{
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {items.map((it) => (
                <div
                  key={it.id}
                  className="wm-colophon-row"
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 0,
                    borderBottom: "1px solid rgba(248,245,240,0.08)",
                    paddingBottom: 16,
                    margin: 0,
                  }}
                >
                  <dt
                    style={{
                      flex: "0 0 180px",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      color: "#C4A45A",
                      paddingTop: 3,
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {it.label || " "}
                  </dt>
                  <dd
                    style={{
                      flex: 1,
                      margin: 0,
                      fontFamily: "var(--font-title)",
                      fontSize: 17,
                      fontWeight: 300,
                      lineHeight: 1.5,
                      color: "rgba(248,245,240,0.85)",
                    }}
                  >
                    {it.value || " "}
                  </dd>
                </div>
              ))}
            </dl>
            <hr style={goldRule} />
          </>
        )}

        {colophon.closingLine.trim() && (
          <div
            style={{
              textAlign: "center",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              color: "rgba(248,245,240,0.35)",
              letterSpacing: 1,
              lineHeight: 1.6,
            }}
          >
            {colophon.closingLine.trim()}
          </div>
        )}

        <div
          style={{
            textAlign: "center",
            marginTop: 36,
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "rgba(248,245,240,0.15)",
            fontFamily: "var(--font-body)",
          }}
        >
          &mdash; fin &mdash;
        </div>

        {/* "Made with Waymark" footer per spec — centered, low opacity. */}
        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(248,245,240,0.25)",
            fontFamily: "var(--font-body)",
          }}
        >
          Made with Waymark
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 500px) {
          [data-export-colophon] {
            padding: 48px 24px !important;
          }
          .wm-colophon-row {
            flex-direction: column !important;
            gap: 4px !important;
          }
          .wm-colophon-row dt {
            flex: auto !important;
            padding-top: 0 !important;
          }
        }
      `}</style>
    </section>
  );
}
