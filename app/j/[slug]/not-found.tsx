import Link from "next/link";

export default function PublicJournalNotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        color: "var(--color-ink)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="flex justify-between items-center"
        style={{ background: "var(--color-ink)", color: "var(--color-paper)", padding: "10px 20px", fontSize: 11 }}
      >
        <Link
          href="/"
          className="font-title"
          style={{
            fontWeight: 400,
            fontSize: 12,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          Waymark
        </Link>
        <Link
          href="/"
          className="font-body"
          style={{
            background: "var(--color-accent)",
            color: "#fff",
            textDecoration: "none",
            padding: "6px 14px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Create yours &rarr;
        </Link>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          textAlign: "center",
        }}
      >
        <div className="font-title" style={{ fontSize: 22, marginBottom: 18, maxWidth: 480 }}>
          This journal doesn&apos;t exist or is no longer available.
        </div>
        <Link
          href="/"
          className="font-body"
          style={{
            background: "var(--color-accent)",
            color: "#fff",
            textDecoration: "none",
            padding: "12px 22px",
            borderRadius: 5,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Create your own journal &rarr;
        </Link>
      </div>
    </div>
  );
}
