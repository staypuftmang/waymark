import Link from "next/link";
import SiteFooter from "./SiteFooter";

interface StaticPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

/**
 * Shell for /privacy and /terms: Waymark logo header → max-680px content
 * column → Privacy · Terms footer. Ivory background.
 */
export default function StaticPageLayout({ title, lastUpdated, children }: StaticPageLayoutProps) {
  return (
    <div className="min-h-screen bg-paper font-body">
      <div
        className="sticky top-0 z-[100] flex items-center justify-between"
        style={{ background: "var(--color-ink)", padding: "16px 24px" }}
      >
        <Link
          href="/"
          className="font-title"
          style={{
            fontSize: 15,
            fontWeight: 400,
            color: "var(--color-paper)",
            letterSpacing: 2,
            textTransform: "uppercase",
            opacity: 0.9,
            textDecoration: "none",
          }}
        >
          Waymark
        </Link>
      </div>

      <main
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        <h1
          className="font-title"
          style={{
            fontSize: 32,
            fontWeight: 300,
            color: "var(--color-ink)",
            marginBottom: 8,
          }}
        >
          {title}
        </h1>
        <div style={{ fontSize: 12, color: "var(--color-stone)", marginBottom: 36 }}>
          Last updated: {lastUpdated}
        </div>

        <div
          className="wm-static-body"
          style={{
            fontSize: 15,
            lineHeight: 1.8,
            color: "var(--color-ink)",
          }}
        >
          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
