import { Photo, VisualStyleKey, LayoutKey } from "@/app/lib/types";
import { VS, LO } from "@/app/lib/constants";
import { LayoutMap } from "./layouts";

interface PublicJournalViewProps {
  tripTitle: string;
  tripBrief: string;
  dateDisplay: string;
  photos: Photo[];
  visualStyleKey: VisualStyleKey;
  layoutKey: LayoutKey;
  coverPhotoId: number | null;
  coverTitle: string;
  coverSubtitle: string;
}

export default function PublicJournalView({
  tripTitle,
  tripBrief,
  dateDisplay,
  photos,
  visualStyleKey: vk,
  layoutKey: lo,
  coverPhotoId,
  coverTitle,
  coverSubtitle,
}: PublicJournalViewProps) {
  const vs = VS[vk];
  const LayoutComponent = LayoutMap[lo];
  const coverPhoto = coverPhotoId !== null ? photos.find((p) => p.id === coverPhotoId) : null;
  const displayCoverTitle = coverTitle || tripTitle;

  return (
    <div style={{ minHeight: "100vh", background: vs.bg, color: vs.fg }}>
      {/* Public header: WAYMARK logo + Create yours */}
      <div
        className="sticky top-0 z-[100] flex justify-between items-center"
        style={{ background: vs.fg, color: vs.bg, padding: "10px 20px", fontSize: 11 }}
      >
        <a
          href="/"
          className="font-title"
          style={{
            fontWeight: 400,
            fontSize: 12,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "inherit",
            textDecoration: "none",
            opacity: 0.85,
          }}
        >
          Waymark
        </a>
        <a
          href="/"
          className="font-body"
          style={{
            background: vs.accent,
            color: "#fff",
            textDecoration: "none",
            padding: "6px 14px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Create yours &rarr;
        </a>
      </div>

      {/* Cover */}
      {coverPhoto ? (
        <div style={{ padding: "24px 24px 0" }}>
          <div
            data-cover-hero
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 960,
              margin: "0 auto",
              borderRadius: vs.bg === "#0F0F0F" || vk === "brutalist" ? 0 : 5,
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverPhoto.src}
              alt=""
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                maxHeight: "min(60vh, 600px)",
                objectFit: "contain",
                margin: "0 auto",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                padding: "32px",
                background: "rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: vs.fontTitle,
                  fontSize: vk === "polaroid" ? 44 : vk === "brutalist" ? 32 : vk === "darkroom" ? 36 : vk === "botanical" ? 38 : 40,
                  fontWeight: 700,
                  color: "#fff",
                  textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                  lineHeight: 1.15,
                  marginBottom: 10,
                  maxWidth: "85%",
                  letterSpacing: vk === "darkroom" ? 2 : vk === "brutalist" ? 1 : 0,
                  textTransform: vk === "brutalist" || vk === "darkroom" ? "uppercase" : "none",
                }}
              >
                {displayCoverTitle}
              </div>
              {dateDisplay && (
                <div
                  style={{
                    fontFamily: vs.fontCaption,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.85)",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                    marginBottom: coverSubtitle ? 8 : 0,
                  }}
                >
                  {dateDisplay}
                </div>
              )}
              {coverSubtitle && (
                <div
                  style={{
                    fontFamily: vs.fontCaption,
                    fontStyle: "italic",
                    fontSize: vk === "polaroid" ? 15 : vk === "brutalist" ? 13 : vk === "darkroom" ? 14 : 16,
                    color: "#fff",
                    textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                    maxWidth: "80%",
                  }}
                >
                  {coverSubtitle}
                </div>
              )}
            </div>
          </div>
          {tripBrief && (
            <div
              style={{
                fontFamily: vs.fontBody,
                fontSize: 16,
                lineHeight: 1.8,
                maxWidth: 540,
                margin: "32px auto 0",
                opacity: 0.85,
                fontStyle: vk === "editorial" ? "italic" : "normal",
                whiteSpace: "pre-line",
                textAlign: "center",
                textShadow: "0 2px 8px rgba(0,0,0,0.6)",
              }}
            >
              {tripBrief}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center" style={{ padding: "60px 24px 40px" }}>
          {dateDisplay && (
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, opacity: 0.35, marginBottom: 14 }}>
              {dateDisplay}
            </div>
          )}
          <h1
            style={{
              fontFamily: vs.fontTitle,
              fontSize: 38,
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: 520,
              textTransform: vk === "brutalist" || vk === "darkroom" ? "uppercase" : "none",
            }}
          >
            {tripTitle}
          </h1>
          <div style={{ width: 28, height: 1.5, background: vs.accent, margin: "22px auto 0" }} />
          {tripBrief && (
            <div
              style={{
                fontFamily: vs.fontBody,
                fontSize: 16,
                lineHeight: 1.8,
                maxWidth: 540,
                marginTop: 22,
                opacity: 0.8,
                fontStyle: vk === "editorial" ? "italic" : "normal",
                whiteSpace: "pre-line",
              }}
            >
              {tripBrief}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div
        style={{
          maxWidth: lo === "filmstrip" ? 960 : 780,
          margin: "0 auto",
          padding: "36px 24px 40px",
        }}
      >
        <LayoutComponent photos={photos} vs={vs} vk={vk} />

        <div
          style={{
            textAlign: "center",
            marginTop: 56,
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: 3,
            opacity: 0.2,
          }}
        >
          &mdash; fin &mdash;
        </div>
      </div>

      {/* CTA after FIN */}
      <div style={{ padding: "0 24px 60px" }}>
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: "40px 32px",
            border: `1px solid ${vs.fg}18`,
            borderRadius: 8,
            background: `${vs.fg}06`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-fraunces)",
              fontSize: 24,
              fontWeight: 400,
              lineHeight: 1.25,
              marginBottom: 10,
            }}
          >
            Your trip deserves this too.
          </div>
          <div
            style={{
              fontFamily: "var(--font-manrope)",
              fontSize: 14,
              opacity: 0.75,
              marginBottom: 22,
            }}
          >
            Turn your photos into a journal in under 4 minutes.
          </div>
          <a
            href="/"
            style={{
              display: "inline-block",
              background: vs.accent,
              color: "#fff",
              textDecoration: "none",
              padding: "12px 24px",
              borderRadius: 5,
              fontFamily: "var(--font-manrope)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Create your journal &mdash; free &rarr;
          </a>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          padding: "20px 24px 40px",
          fontFamily: vs.fontCaption,
          fontSize: 11,
          opacity: 0.55,
        }}
      >
        <div style={{ marginBottom: 6 }}>
          Made with Waymark &middot;{" "}
          <a href="/" style={{ color: "inherit", textDecoration: "underline" }}>
            mywaymarks.com
          </a>
        </div>
        <div>
          <a href="/privacy" style={{ color: "inherit", textDecoration: "none", opacity: 0.85 }}>
            Privacy
          </a>{" "}
          &middot;{" "}
          <a href="/terms" style={{ color: "inherit", textDecoration: "none", opacity: 0.85 }}>
            Terms
          </a>
        </div>
      </div>

      {/* Hidden marker for unused style label (avoids unused-import lints) */}
      <span style={{ display: "none" }}>{vs.label} / {LO[lo].label}</span>
    </div>
  );
}
