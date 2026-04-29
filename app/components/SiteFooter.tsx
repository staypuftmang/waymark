import Link from "next/link";

/**
 * Small Privacy · Terms footer, rendered site-wide below any existing
 * footer content (landing, builder, preview, static pages).
 */
export default function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <div
      className={`text-center ${className}`}
      style={{
        fontSize: 11,
        color: "var(--color-stone)",
        padding: "16px 20px 24px",
        fontFamily: "var(--font-body)",
      }}
    >
      <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
        Privacy
      </Link>
      <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
      <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>
        Terms
      </Link>
      <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
      <Link href="/help" style={{ color: "inherit", textDecoration: "none" }}>
        Help
      </Link>
    </div>
  );
}
